// Дублювання рядка таблиці як «нової людини/курсанта» (user flow, не admin).
//
// Захоплення engine-кнопки «+» (button.docx-table-insert-row, шар
// .docx-table-furniture двигуна) з dataset.tableId / dataset.rowId —
// публічний контракт furniture. Модельний рівень:
// editor.exec({ type: "insertRow", where: "below", target }) — двигун
// копіює tcPr-скелет кожної комірки (ширина/borders/alignment/shd) і
// ставить каретку в перший новий абзац; вміст комірок — порожні абзаци
// (структура без даних людини — це і є потрібне дублювання).
//
// ПОРЯДОК (обов'язковий):
//   1. SNAPSHOT ДО insertRow: всі staff/cadet чіпи документа
//      (customNodesOf → resolvePersonField → review item АБО DOM-фолбек
//      для paraId) + caret-probe з кожного чіпа — rowIndex/columnIndex
//      призначається ДО вставки;
//   2. РІШЕННЯ про перехоплення ДО вставки: рядок engine-кнопки — це
//      вертикальна полоса (band); чіпи групуються за rowIndex, полоса
//      кожної групи [minTop..maxBottom] перевіряється на попадання
//      centerY кнопки → source row знайдений або «чужого тут немає»;
//   3. визначення newInstance = max(instance same flavor) + 1 (staff і
//      cadet — окремі namespaces);
//   4. targeted insertRow BELOW (tableId + rowId + sourceRevision),
//      без fallback: відмова → warn/toast, документ не змінюється;
//   5. newRowIndex з каретки — sanity-перевірка (source + 1);
//   6. ре-ключ чіпів sourceRow: attrs { key: staff.N.<field> } БЕЗ p,
//      текст — дефолтна назва поля («ПІБ (N)») / COURSE_FIELD_LABELS;
//   7. signature: тільки новий маркер, floating image НЕ копіюється.
//
// Обмеження v1: статичний текст і номер рядка не копіюються (немає
// публічного читання тексту комірки); без DOM cloning / innerHTML /
// MutationObserver / рядкових замін.

import { customNodesOf, insertCustomNode } from "@docx-editor.dev/pro"
import { toast } from "sonner"

import { resolvePersonField } from "@/components/documents/docx-editor/personnel-picker"
import { suspendFieldSelect } from "@/components/documents/docx-editor/field-select"
import { FieldNode, type FieldChipAttrs } from "@/lib/docx-editor/field-node"
import { COURSE_FIELD_LABELS } from "@/lib/courses/types"

const LOG = "[table-row-duplicate]"

// Людські назви полів staff за типом (коротка мапа — PERSONNEL_FIELD_LABELS
// живе в панелі-компоненті, дублюємо, щоб не тягнути UI в lib)
const STAFF_FIELD_LABELS: Record<string, string> = {
  fullName: "ПІБ",
  position: "Посада",
  rank: "Звання",
  signature: "Підпис",
}

export type DuplicateRowOutcome =
  | { readonly ok: true }
  | {
      readonly ok: false
      readonly reason: "no-personal-chips" | "insert-refused" | "no-new-row"
    }

type EditorLike = Parameters<typeof resolvePersonField>[0]

// Чіп sourceRow із знімку ДО вставки
type ChipSnapshot = {
  readonly nodeId: string
  readonly flavor: "staff" | "cadet"
  readonly sourceInstance: number
  readonly fieldType: string
  /** Абзац чіпа (review item або DOM) для caret-probe */
  readonly paraId: string
  /** Iндекс рядка/комірки, прочитаний tableContext ПІД час знімку */
  readonly rowIndex: number
  readonly columnIndex: number
  /** Вертикальний span чіпа в пейнтованому DOM — для row-band матчингу кнопки */
  readonly top: number
  readonly bottom: number
  /** Порядок у документі (customNodesOf) — порядок вставки в клон */
  readonly docOrder: number
}

type CustomNodeRef = Parameters<typeof resolvePersonField>[1]

function documentRevision(editor: EditorLike): number {
  try {
    if (typeof editor.getDocumentHandle === "function") {
      return editor.getDocumentHandle().revision
    }
  } catch {
    // revision недоступний — target може бути відхилено can(); без fallback
  }
  return 0
}

function paraIdOfSelection(editor: EditorLike): string | null {
  const selection = editor.query({ type: "selection" })
  const from = selection?.from as { paraId?: string } | undefined
  return from?.paraId ?? null
}

// caret-probe: каретка в абзац → rowIndex/columnIndex з tableContext
function probePosition(
  editor: EditorLike,
  paraId: string
): { rowIndex: number; columnIndex: number } | null {
  if (!editor.exec({ type: "setSelection", anchor: { paraId } }).ok) return null
  const context = editor.query({ type: "tableContext" })
  if (!context) return null
  return { rowIndex: context.rowIndex, columnIndex: context.columnIndex }
}

/**
 * ParaId чіпа: спершу review item (item.range.start.paragraphId); якщо
 * range ще не розв'язано layout'ом — DOM-фолбек: хром чіпа
 * (.docx-content-control-chrome[data-docx-content-control]) →
 * найближчий [data-paragraph-id] (той самий патерн, що в bindSignatureImage).
 */
function chipParagraphId(editor: EditorLike, nodeId: string): string | null {
  for (const entry of editor.getReviewItems()) {
    if (entry.kind !== "custom" || entry.item.id !== nodeId) continue
    const paraId = entry.item.range?.start?.paragraphId ?? null
    if (paraId) return paraId
    break
  }
  const chrome = document.querySelector<HTMLElement>(
    `.docx-content-control-chrome[data-docx-content-control="${CSS.escape(nodeId)}"]`
  )
  const paragraphEl = chrome?.querySelector<HTMLElement>(".docx-content-control-boundary")
    ?.closest<HTMLElement>("[data-paragraph-id]")
  return paragraphEl?.getAttribute("data-paragraph-id") ?? null
}

/**
 * Snapshot всіх персональних чіпів ДО insertRow: ре-ключі attrs, колонка/
 * рядок (caret-probe) та вертикальний span чіпа (для матчингу engine-кнопки
 * з рядком — БЕЗ вставки). Каретку після знімку повертає викликач.
 */
function snapshotChips(editor: EditorLike): ChipSnapshot[] {
  const chips: ChipSnapshot[] = []
  let docOrder = 0
  for (const node of customNodesOf(editor)) {
    const info = resolvePersonField(editor, node as unknown as CustomNodeRef)
    if (!info) continue
    const attrs = node.attrs as FieldChipAttrs
    if (!attrs.key) continue
    const nodeId = node.nodeId ?? ""
    const paraId = chipParagraphId(editor, nodeId)
    if (!paraId) {
      continue
    }
    const probed = probePosition(editor, paraId)
    if (!probed) continue
    // Вертикальний span чіпа — для класифікації рядка engine-кнопкою
    const boundary = document.querySelector<HTMLElement>(
      `.docx-content-control-chrome[data-docx-content-control="${CSS.escape(nodeId)}"] .docx-content-control-boundary`
    )
    const rect = boundary?.getBoundingClientRect()
    chips.push({
      nodeId,
      flavor: info.flavor,
      sourceInstance: info.instance,
      fieldType: info.fieldType,
      paraId,
      rowIndex: probed.rowIndex,
      columnIndex: probed.columnIndex,
      top: rect?.top ?? 0,
      bottom: rect?.bottom ?? 0,
      docOrder,
    })
    docOrder += 1
  }
  return chips
}

function maxInstanceByFlavor(chips: readonly ChipSnapshot[]): {
  staff: number
  cadet: number
} {
  let staff = 0
  let cadet = 0
  for (const chip of chips) {
    if (chip.flavor === "staff") staff = Math.max(staff, chip.sourceInstance)
    else cadet = Math.max(cadet, chip.sourceInstance)
  }
  return { staff, cadet }
}

/**
 * Назва поля нового instance: дефолтні слова («ПІБ (2)»), не дані людини.
 * staff — короткі назви; cadet — COURSE_FIELD_LABELS.
 */
function defaultLabel(flavor: "staff" | "cadet", fieldType: string, instance: number): string {
  const label =
    flavor === "staff"
      ? STAFF_FIELD_LABELS[fieldType]
      : (COURSE_FIELD_LABELS[fieldType as keyof typeof COURSE_FIELD_LABELS] ?? fieldType)
  return `${label ?? fieldType} (${instance})`
}

/**
 * Абзаци нового рядка: орієнтир — paraId каретки (двигун ставить її в
 * перший новий абзац). Спершу DOM-обхід: [data-paragraph-id] → найближчий
 * row-контейнер; якщо пейнтований DOM не має row-контейнера — обмежений
 * caret-probe абзаців СТОРІНКИ з кареткою, без обходу всього документа.
 */
function collectNewRowParagraphIds(editor: EditorLike, firstParaId: string): string[] {
  const firstEl = document.querySelector<HTMLElement>(
    `[data-paragraph-id="${CSS.escape(firstParaId)}"]`
  )
  if (!firstEl) return [firstParaId]

  const rowContainer = firstEl.closest<HTMLElement>("tr, [data-table-row], [data-row-id]")
  if (rowContainer) {
    const ids = [...rowContainer.querySelectorAll<HTMLElement>("[data-paragraph-id]")].map(
      (el) => el.getAttribute("data-paragraph-id") ?? ""
    )
    const unique = [...new Set(ids.filter(Boolean))]
    if (unique.length > 1) return unique
  }

  // Фолбек: обмежене опитування абзаців сторінки; каретка вже в новому
  // рядку (двигун ставить її після insertRow) — беремо rowIndex звідти
  const newRowIndexProbe = probePosition(editor, firstParaId)
  const newRowIndex = newRowIndexProbe?.rowIndex ?? -1
  if (newRowIndex < 0) return [firstParaId]
  const page = firstEl.closest<HTMLElement>(".docx-editor-page")
  const candidates = page ? [...page.querySelectorAll<HTMLElement>("[data-paragraph-id]")] : []
  const collected: string[] = [firstParaId]
  const seen = new Set([firstParaId])
  for (const candidate of candidates) {
    const paraId = candidate.getAttribute("data-paragraph-id") ?? ""
    if (!paraId || seen.has(paraId)) continue
    const probe = probePosition(editor, paraId)
    if (!probe || probe.rowIndex !== newRowIndex) continue
    seen.add(paraId)
    collected.push(paraId)
  }
  return collected
}

/**
 * Повний user-flow: «+» ⇒ дублікат sourceRow як нового staff/cadet
 * екземпляра. Викликається ТІЛЬКИ коли рядок містить персональні чіпи
 * (класифікація band-мачем ДО вставки); контролер для рядка без чіпів
 * взагалі не викликає цю функцію.
 */
export function duplicateTableRow(
  editor: EditorLike,
  tableId: string,
  rowId: string,
  sourceRowIndex: number
): DuplicateRowOutcome {
  if (!editor) return { ok: false, reason: "no-personal-chips" }

  // 0) Цілісне завершення: призупинення FieldSelect під час процедури
  suspendFieldSelect(true)
  try {
    // SNAPSHOT до insertRow (caret-probe змінює каретку — запам'ятовуємо)
    const originalParaId = paraIdOfSelection(editor)
    const chips = snapshotChips(editor)
    if (originalParaId) {
      editor.exec({ type: "setSelection", anchor: { paraId: originalParaId } })
    }

    // 1) newInstance = max(existing same flavor) + 1 — staff і cadet окремі namespaces
    const maxInstance = maxInstanceByFlavor(chips)
    const nextInstance = {
      staff: maxInstance.staff + 1,
      cadet: maxInstance.cadet + 1,
    }
    const sourceChips = chips
      .filter((c) => c.rowIndex === sourceRowIndex)
      .sort((a, b) => a.docOrder - b.docOrder)
    if (sourceChips.length === 0) {
      return { ok: false, reason: "no-personal-chips" }
    }
    const primaryFlavor: "staff" | "cadet" = sourceChips[0]!.flavor

    // 2) targeted insertRow BELOW — тільки через tableId + rowId + sourceRevision
    const insertCommand = {
      type: "insertRow" as const,
      where: "below" as const,
      target: { tableId, rowId, sourceRevision: documentRevision(editor), isHeaderRepeat: false },
    }
    const can = editor.can(insertCommand)
    if (!can.ok) {
      console.warn(LOG, "targeted insertRow відхилено can() →", can.reason)
      toast.error("Не вдалося додати рядок після цього рядка. Спробуйте ще раз.")
      return { ok: false, reason: "insert-refused" }
    }
    const insert = editor.exec(insertCommand)
    if (!insert.ok) {
      console.warn(LOG, "targeted insertRow відхилено exec() →", insert.reason)
      toast.error("Не вдалося додати рядок. Спробуйте ще раз.")
      return { ok: false, reason: "insert-refused" }
    }

    // 3) Sanity: каретка в новому рядку (двигун ставить її туди сама)
    const firstParaId = paraIdOfSelection(editor)
    if (!firstParaId) {
      console.warn(LOG, "каретка після insertRow не в новому рядку — вставка чіпів неможлива")
      toast.warning("Рядок вставлено, але нові поля не вдалося створити автоматично.")
      return { ok: false, reason: "no-new-row" }
    }
    const context = editor.query({ type: "tableContext" })
    if (context && context.rowIndex !== sourceRowIndex + 1) {
      console.warn(LOG, "rowIndex не став source+1 →", {
        newRowIndex: context.rowIndex,
        sourceRowIndex,
      })
    }

    // 4) Абзаци нового рядка → paraId → комірка columnIndex (caret-probe)
    const newRowParas = collectNewRowParagraphIds(editor, firstParaId)
    const paraByColumn = new Map<number, string>()
    for (const paraId of newRowParas) {
      const probe = probePosition(editor, paraId)
      if (!probe || probe.rowIndex !== sourceRowIndex + 1) continue
      if (!paraByColumn.has(probe.columnIndex)) paraByColumn.set(probe.columnIndex, paraId)
    }

    // 5) Вставка ре-ключених чіпів: attrs { key нового instance } БЕЗ p,
    //    текст — дефолтна назва поля нового instance
    for (const chip of sourceChips) {
      const instance = nextInstance[chip.flavor]
      const key = `${chip.flavor}.${instance}.${chip.fieldType}`
      const targetParaId = paraByColumn.get(chip.columnIndex) ?? firstParaId
      if (!editor.exec({ type: "setSelection", anchor: { paraId: targetParaId } }).ok) {
        console.warn(LOG, "каретка не поставлена в нову комірку →", {
          chipNodeId: chip.nodeId,
          targetParaId,
        })
        continue
      }
      const label = defaultLabel(chip.flavor, chip.fieldType, instance)
      const result = insertCustomNode(editor, FieldNode, {
        attrs: { key },
        text: label,
        alias: label,
        lock: false,
      })
      if (!result.ok) {
        console.warn(LOG, "insertCustomNode нового чіпа відхилено →", {
          key,
          reason: result.reason,
        })
        continue
      }
    }

    toast.success(
      `Додано людину №${nextInstance[primaryFlavor] ?? 1}. Прив'яжіть особу кнопкою на чіпі.`
    )
    return { ok: true }
  } finally {
    suspendFieldSelect(false)
  }
}
