// Р”СѓР±Р»СЋРІР°РЅРЅСЏ СЂСЏРґРєР° С‚Р°Р±Р»РёС†С– СЏРє В«РЅРѕРІРѕС— Р»СЋРґРёРЅРё/РєСѓСЂСЃР°РЅС‚Р°В» (user flow, РЅРµ admin).
//
// Р—Р°С…РѕРїР»РµРЅРЅСЏ engine-РєРЅРѕРїРєРё В«+В» (button.docx-table-insert-row, С€Р°СЂ
// .docx-table-furniture РґРІРёРіСѓРЅР°) Р· dataset.tableId / dataset.rowId вЂ”
// РїСѓР±Р»С–С‡РЅРёР№ РєРѕРЅС‚СЂР°РєС‚ furniture. РњРѕРґРµР»СЊРЅРёР№ СЂС–РІРµРЅСЊ:
// editor.exec({ type: "insertRow", where: "below", target }) вЂ” РґРІРёРіСѓРЅ
// РєРѕРїС–СЋС” tcPr-СЃРєРµР»РµС‚ РєРѕР¶РЅРѕС— РєРѕРјС–СЂРєРё (С€РёСЂРёРЅР°/borders/alignment/shd) С–
// СЃС‚Р°РІРёС‚СЊ РєР°СЂРµС‚РєСѓ РІ РїРµСЂС€РёР№ РЅРѕРІРёР№ Р°Р±Р·Р°С†; РІРјС–СЃС‚ РєРѕРјС–СЂРѕРє вЂ” РїРѕСЂРѕР¶РЅС– Р°Р±Р·Р°С†Рё
// (СЃС‚СЂСѓРєС‚СѓСЂР° Р±РµР· РґР°РЅРёС… Р»СЋРґРёРЅРё вЂ” С†Рµ С– С” РїРѕС‚СЂС–Р±РЅРµ РґСѓР±Р»СЋРІР°РЅРЅСЏ).
//
// РџРћР РЇР”РћРљ (РѕР±РѕРІ'СЏР·РєРѕРІРёР№):
//   1. SNAPSHOT Р”Рћ insertRow: РІСЃС– staff/cadet С‡С–РїРё РґРѕРєСѓРјРµРЅС‚Р°
//      (customNodesOf в†’ resolvePersonField в†’ review item РђР‘Рћ DOM-С„РѕР»Р±РµРє
//      РґР»СЏ paraId) + caret-probe Р· РєРѕР¶РЅРѕРіРѕ С‡С–РїР° вЂ” rowIndex/columnIndex
//      РїСЂРёР·РЅР°С‡Р°С”С‚СЊСЃСЏ Р”Рћ РІСЃС‚Р°РІРєРё;
//   2. Р Р†РЁР•РќРќРЇ РїСЂРѕ РїРµСЂРµС…РѕРїР»РµРЅРЅСЏ Р”Рћ РІСЃС‚Р°РІРєРё: СЂСЏРґРѕРє engine-РєРЅРѕРїРєРё вЂ” С†Рµ
//      РІРµСЂС‚РёРєР°Р»СЊРЅР° РїРѕР»РѕСЃР° (band); С‡С–РїРё РіСЂСѓРїСѓСЋС‚СЊСЃСЏ Р·Р° rowIndex, РїРѕР»РѕСЃР°
//      РєРѕР¶РЅРѕС— РіСЂСѓРїРё [minTop..maxBottom] РїРµСЂРµРІС–СЂСЏС”С‚СЊСЃСЏ РЅР° РїРѕРїР°РґР°РЅРЅСЏ
//      centerY РєРЅРѕРїРєРё в†’ source row Р·РЅР°Р№РґРµРЅРёР№ Р°Р±Рѕ В«С‡СѓР¶РѕРіРѕ С‚СѓС‚ РЅРµРјР°С”В»;
//   3. РІРёР·РЅР°С‡РµРЅРЅСЏ newInstance = max(instance same flavor) + 1 (staff С–
//      cadet вЂ” РѕРєСЂРµРјС– namespaces);
//   4. targeted insertRow BELOW (tableId + rowId + sourceRevision),
//      Р±РµР· fallback: РІС–РґРјРѕРІР° в†’ warn/toast, РґРѕРєСѓРјРµРЅС‚ РЅРµ Р·РјС–РЅСЋС”С‚СЊСЃСЏ;
//   5. newRowIndex Р· РєР°СЂРµС‚РєРё вЂ” sanity-РїРµСЂРµРІС–СЂРєР° (source + 1);
//   6. СЂРµ-РєР»СЋС‡ С‡С–РїС–РІ sourceRow: attrs { key: staff.N.<field> } Р‘Р•Р— p,
//      С‚РµРєСЃС‚ вЂ” РґРµС„РѕР»С‚РЅР° РЅР°Р·РІР° РїРѕР»СЏ (В«РџР†Р‘ (N)В») / COURSE_FIELD_LABELS;
//   7. signature: С‚С–Р»СЊРєРё РЅРѕРІРёР№ РјР°СЂРєРµСЂ, floating image РќР• РєРѕРїС–СЋС”С‚СЊСЃСЏ.
//
// РћР±РјРµР¶РµРЅРЅСЏ v1: СЃС‚Р°С‚РёС‡РЅРёР№ С‚РµРєСЃС‚ С– РЅРѕРјРµСЂ СЂСЏРґРєР° РЅРµ РєРѕРїС–СЋСЋС‚СЊСЃСЏ (РЅРµРјР°С”
// РїСѓР±Р»С–С‡РЅРѕРіРѕ С‡РёС‚Р°РЅРЅСЏ С‚РµРєСЃС‚Сѓ РєРѕРјС–СЂРєРё); Р±РµР· DOM cloning / innerHTML /
// MutationObserver / СЂСЏРґРєРѕРІРёС… Р·Р°РјС–РЅ.

import { customNodesOf, insertCustomNode } from "@docx-editor.dev/pro"
import { toast } from "sonner"

import { resolvePersonField } from "@/components/documents/docx-editor/personnel-picker"
import { suspendFieldSelect } from "@/components/documents/docx-editor/field-select"
import { FieldNode, type FieldChipAttrs } from "@/lib/docx-editor/field-node"
import { COURSE_FIELD_LABELS } from "@/lib/courses/types"

const LOG = "[table-row-duplicate]"

// Р›СЋРґСЃСЊРєС– РЅР°Р·РІРё РїРѕР»С–РІ staff Р·Р° С‚РёРїРѕРј (РєРѕСЂРѕС‚РєР° РјР°РїР° вЂ” PERSONNEL_FIELD_LABELS
// Р¶РёРІРµ РІ РїР°РЅРµР»С–-РєРѕРјРїРѕРЅРµРЅС‚С–, РґСѓР±Р»СЋС”РјРѕ, С‰РѕР± РЅРµ С‚СЏРіРЅСѓС‚Рё UI РІ lib)
const STAFF_FIELD_LABELS: Record<string, string> = {
  fullName: "РџР†Р‘",
  position: "РџРѕСЃР°РґР°",
  rank: "Р—РІР°РЅРЅСЏ",
  signature: "РџС–РґРїРёСЃ",
}

export type DuplicateRowOutcome =
  | { readonly ok: true; readonly chipsInserted: number; readonly newInstance: number }
  | {
      readonly ok: false
      readonly reason: "no-personal-chips" | "insert-refused" | "no-new-row"
    }

type EditorLike = Parameters<typeof resolvePersonField>[0]

// Р§С–Рї sourceRow С–Р· Р·РЅС–РјРєСѓ Р”Рћ РІСЃС‚Р°РІРєРё
type ChipSnapshot = {
  readonly nodeId: string
  readonly flavor: "staff" | "cadet"
  readonly sourceInstance: number
  readonly fieldType: string
  /** РђР±Р·Р°С† С‡С–РїР° (review item Р°Р±Рѕ DOM) РґР»СЏ caret-probe */
  readonly paraId: string
  /** IРЅРґРµРєСЃ СЂСЏРґРєР°/РєРѕРјС–СЂРєРё, РїСЂРѕС‡РёС‚Р°РЅРёР№ tableContext РџР†Р” С‡Р°СЃ Р·РЅС–РјРєСѓ */
  readonly rowIndex: number
  readonly columnIndex: number
  /** Р’РµСЂС‚РёРєР°Р»СЊРЅРёР№ span С‡С–РїР° РІ РїРµР№РЅС‚РѕРІР°РЅРѕРјСѓ DOM вЂ” РґР»СЏ row-band РјР°С‚С‡РёРЅРіСѓ РєРЅРѕРїРєРё */
  readonly top: number
  readonly bottom: number
  /** РџРѕСЂСЏРґРѕРє Сѓ РґРѕРєСѓРјРµРЅС‚С– (customNodesOf) вЂ” РїРѕСЂСЏРґРѕРє РІСЃС‚Р°РІРєРё РІ РєР»РѕРЅ */
  readonly docOrder: number
}

type CustomNodeRef = Parameters<typeof resolvePersonField>[1]

function documentRevision(editor: EditorLike): number {
  try {
    if (typeof editor.getDocumentHandle === "function") {
      return editor.getDocumentHandle().revision
    }
  } catch {
    // revision РЅРµРґРѕСЃС‚СѓРїРЅРёР№ вЂ” target РјРѕР¶Рµ Р±СѓС‚Рё РІС–РґС…РёР»РµРЅРѕ can(); Р±РµР· fallback
  }
  return 0
}

function paraIdOfSelection(editor: EditorLike): string | null {
  const selection = editor.query({ type: "selection" })
  const from = selection?.from as { paraId?: string } | undefined
  return from?.paraId ?? null
}

// caret-probe: РєР°СЂРµС‚РєР° РІ Р°Р±Р·Р°С† в†’ rowIndex/columnIndex Р· tableContext
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
 * ParaId С‡С–РїР°: СЃРїРµСЂС€Сѓ review item (item.range.start.paragraphId); СЏРєС‰Рѕ
 * range С‰Рµ РЅРµ СЂРѕР·РІ'СЏР·Р°РЅРѕ layout'РѕРј вЂ” DOM-С„РѕР»Р±РµРє: С…СЂРѕРј С‡С–РїР°
 * (.docx-content-control-chrome[data-docx-content-control]) в†’
 * РЅР°Р№Р±Р»РёР¶С‡РёР№ [data-paragraph-id] (С‚РѕР№ СЃР°РјРёР№ РїР°С‚РµСЂРЅ, С‰Рѕ РІ bindSignatureImage).
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
 * Snapshot РІСЃС–С… РїРµСЂСЃРѕРЅР°Р»СЊРЅРёС… С‡С–РїС–РІ Р”Рћ insertRow: СЂРµ-РєР»СЋС‡С– attrs, РєРѕР»РѕРЅРєР°/
 * СЂСЏРґРѕРє (caret-probe) С‚Р° РІРµСЂС‚РёРєР°Р»СЊРЅРёР№ span С‡С–РїР° (РґР»СЏ РјР°С‚С‡РёРЅРіСѓ engine-РєРЅРѕРїРєРё
 * Р· СЂСЏРґРєРѕРј вЂ” Р‘Р•Р— РІСЃС‚Р°РІРєРё). РљР°СЂРµС‚РєСѓ РїС–СЃР»СЏ Р·РЅС–РјРєСѓ РїРѕРІРµСЂС‚Р°С” РІРёРєР»РёРєР°С‡.
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
      console.info(LOG, "С‡РёРї Р±РµР· paraId РїСЂРѕРїСѓС‰РµРЅРѕ в†’", { nodeId, key: attrs.key })
      continue
    }
    const probed = probePosition(editor, paraId)
    if (!probed) continue
    // Р’РµСЂС‚РёРєР°Р»СЊРЅРёР№ span С‡С–РїР° вЂ” РґР»СЏ РєР»Р°СЃРёС„С–РєР°С†С–С— СЂСЏРґРєР° engine-РєРЅРѕРїРєРѕСЋ
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
  console.info(LOG, "snapshot С‡С–РїС–РІ в†’", {
    count: chips.length,
    rows: [...new Set(chips.map((c) => c.rowIndex))],
  })
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
 * РќР°Р·РІР° РїРѕР»СЏ РЅРѕРІРѕРіРѕ instance: РґРµС„РѕР»С‚РЅС– СЃР»РѕРІР° (В«РџР†Р‘ (2)В»), РЅРµ РґР°РЅС– Р»СЋРґРёРЅРё.
 * staff вЂ” РєРѕСЂРѕС‚РєС– РЅР°Р·РІРё; cadet вЂ” COURSE_FIELD_LABELS.
 */
function defaultLabel(flavor: "staff" | "cadet", fieldType: string, instance: number): string {
  const label =
    flavor === "staff"
      ? STAFF_FIELD_LABELS[fieldType]
      : (COURSE_FIELD_LABELS[fieldType as keyof typeof COURSE_FIELD_LABELS] ?? fieldType)
  return `${label ?? fieldType} (${instance})`
}

/**
 * РђР±Р·Р°С†Рё РЅРѕРІРѕРіРѕ СЂСЏРґРєР°: РѕСЂС–С”РЅС‚РёСЂ вЂ” paraId РєР°СЂРµС‚РєРё (РґРІРёРіСѓРЅ СЃС‚Р°РІРёС‚СЊ С—С— РІ
 * РїРµСЂС€РёР№ РЅРѕРІРёР№ Р°Р±Р·Р°С†). РЎРїРµСЂС€Сѓ DOM-РѕР±С…С–Рґ: [data-paragraph-id] в†’ РЅР°Р№Р±Р»РёР¶С‡РёР№
 * row-РєРѕРЅС‚РµР№РЅРµСЂ; СЏРєС‰Рѕ РїРµР№РЅС‚РѕРІР°РЅРёР№ DOM РЅРµ РјР°С” row-РєРѕРЅС‚РµР№РЅРµСЂР° вЂ” РѕР±РјРµР¶РµРЅРёР№
 * caret-probe Р°Р±Р·Р°С†С–РІ РЎРўРћР Р†РќРљР Р· РєР°СЂРµС‚РєРѕСЋ, Р±РµР· РѕР±С…РѕРґСѓ РІСЃСЊРѕРіРѕ РґРѕРєСѓРјРµРЅС‚Р°.
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

  // Р¤РѕР»Р±РµРє: РѕР±РјРµР¶РµРЅРµ РѕРїРёС‚СѓРІР°РЅРЅСЏ Р°Р±Р·Р°С†С–РІ СЃС‚РѕСЂС–РЅРєРё; РєР°СЂРµС‚РєР° РІР¶Рµ РІ РЅРѕРІРѕРјСѓ
  // СЂСЏРґРєСѓ (РґРІРёРіСѓРЅ СЃС‚Р°РІРёС‚СЊ С—С— РїС–СЃР»СЏ insertRow) вЂ” Р±РµСЂРµРјРѕ rowIndex Р·РІС–РґС‚Рё
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
 * РџРѕРІРЅРёР№ user-flow: В«+В» в‡’ РґСѓР±Р»С–РєР°С‚ sourceRow СЏРє РЅРѕРІРѕРіРѕ staff/cadet
 * РµРєР·РµРјРїР»СЏСЂР°. Р’РёРєР»РёРєР°С”С‚СЊСЃСЏ РўР†Р›Р¬РљР РєРѕР»Рё СЂСЏРґРѕРє РјС–СЃС‚РёС‚СЊ РїРµСЂСЃРѕРЅР°Р»СЊРЅС– С‡С–РїРё
 * (РєР»Р°СЃРёС„С–РєР°С†С–СЏ band-РјР°С‡РµРј Р”Рћ РІСЃС‚Р°РІРєРё); РєРѕРЅС‚СЂРѕР»РµСЂ РґР»СЏ СЂСЏРґРєР° Р±РµР· С‡С–РїС–РІ
 * РІР·Р°РіР°Р»С– РЅРµ РІРёРєР»РёРєР°С” С†СЋ С„СѓРЅРєС†С–СЋ.
 */
export function duplicateTableRow(
  editor: EditorLike,
  tableId: string,
  rowId: string,
  sourceRowIndex: number
): DuplicateRowOutcome {
  if (!editor) return { ok: false, reason: "no-personal-chips" }

  // 0) Р¦С–Р»С–СЃРЅРµ Р·Р°РІРµСЂС€РµРЅРЅСЏ: РїСЂРёР·СѓРїРёРЅРµРЅРЅСЏ FieldSelect РїС–Рґ С‡Р°СЃ РїСЂРѕС†РµРґСѓСЂРё
  suspendFieldSelect(true)
  try {
    // SNAPSHOT РґРѕ insertRow (caret-probe Р·РјС–РЅСЋС” РєР°СЂРµС‚РєСѓ вЂ” Р·Р°РїР°Рј'СЏС‚РѕРІСѓС”РјРѕ)
    const originalParaId = paraIdOfSelection(editor)
    const chips = snapshotChips(editor)
    if (originalParaId) {
      editor.exec({ type: "setSelection", anchor: { paraId: originalParaId } })
    }

    // 1) newInstance = max(existing same flavor) + 1 вЂ” staff С– cadet РѕРєСЂРµРјС– namespaces
    const nextInstance = {
      staff: maxInstanceByFlavor(chips).staff + 1,
      cadet: maxInstanceByFlavor(chips).cadet + 1,
    }
    const sourceChips = chips
      .filter((c) => c.rowIndex === sourceRowIndex)
      .sort((a, b) => a.docOrder - b.docOrder)
    console.info(LOG, "СЂСЏРґРѕРє С‡С–РїС–РІ sourceRow в†’", {
      sourceRowIndex,
      chips: sourceChips.length,
      keys: sourceChips.map((c) => `${c.flavor}.${c.sourceInstance}.${c.fieldType}`),
    })
    if (sourceChips.length === 0) {
      return { ok: false, reason: "no-personal-chips" }
    }
    const primaryFlavor: "staff" | "cadet" = sourceChips[0]!.flavor

    // 2) targeted insertRow BELOW вЂ” С‚С–Р»СЊРєРё С‡РµСЂРµР· tableId + rowId + sourceRevision
    const insertCommand = {
      type: "insertRow" as const,
      where: "below" as const,
      target: { tableId, rowId, sourceRevision: documentRevision(editor), isHeaderRepeat: false },
    }
    const can = editor.can(insertCommand)
    if (!can.ok) {
      console.warn(LOG, "targeted insertRow РІС–РґС…РёР»РµРЅРѕ can() в†’", can.reason)
      toast.error("РќРµ РІРґР°Р»РѕСЃСЏ РґРѕРґР°С‚Рё СЂСЏРґРѕРє РїС–СЃР»СЏ С†СЊРѕРіРѕ СЂСЏРґРєР°. РЎРїСЂРѕР±СѓР№С‚Рµ С‰Рµ СЂР°Р·.")
      return { ok: false, reason: "insert-refused" }
    }
    const insert = editor.exec(insertCommand)
    if (!insert.ok) {
      console.warn(LOG, "targeted insertRow РІС–РґС…РёР»РµРЅРѕ exec() в†’", insert.reason)
      toast.error("РќРµ РІРґР°Р»РѕСЃСЏ РґРѕРґР°С‚Рё СЂСЏРґРѕРє. РЎРїСЂРѕР±СѓР№С‚Рµ С‰Рµ СЂР°Р·.")
      return { ok: false, reason: "insert-refused" }
    }

    // 3) Sanity: РєР°СЂРµС‚РєР° РІ РЅРѕРІРѕРјСѓ СЂСЏРґРєСѓ (РґРІРёРіСѓРЅ СЃС‚Р°РІРёС‚СЊ С—С— С‚СѓРґРё СЃР°РјР°)
    const firstParaId = paraIdOfSelection(editor)
    if (!firstParaId) {
      console.warn(LOG, "РєР°СЂРµС‚РєР° РїС–СЃР»СЏ insertRow РЅРµ РІ РЅРѕРІРѕРјСѓ СЂСЏРґРєСѓ вЂ” РІСЃС‚Р°РІРєР° С‡С–РїС–РІ РЅРµРјРѕР¶Р»РёРІР°")
      toast.warning("Р СЏРґРѕРє РІСЃС‚Р°РІР»РµРЅРѕ, Р°Р»Рµ РЅРѕРІС– РїРѕР»СЏ РЅРµ РІРґР°Р»РѕСЃСЏ СЃС‚РІРѕСЂРёС‚Рё Р°РІС‚РѕРјР°С‚РёС‡РЅРѕ.")
      return { ok: false, reason: "no-new-row" }
    }
    const context = editor.query({ type: "tableContext" })
    if (context && context.rowIndex !== sourceRowIndex + 1) {
      console.warn(LOG, "rowIndex РЅРµ СЃС‚Р°РІ source+1 в†’", {
        newRowIndex: context.rowIndex,
        sourceRowIndex,
      })
    }

    // 4) РђР±Р·Р°С†Рё РЅРѕРІРѕРіРѕ СЂСЏРґРєР° в†’ paraId в†’ РєРѕРјС–СЂРєР° columnIndex (caret-probe)
    const newRowParas = collectNewRowParagraphIds(editor, firstParaId)
    const paraByColumn = new Map<number, string>()
    for (const paraId of newRowParas) {
      const probe = probePosition(editor, paraId)
      if (!probe || probe.rowIndex !== sourceRowIndex + 1) continue
      if (!paraByColumn.has(probe.columnIndex)) paraByColumn.set(probe.columnIndex, paraId)
    }

    // 5) Р’СЃС‚Р°РІРєР° СЂРµ-РєР»СЋС‡РµРЅРёС… С‡С–РїС–РІ: attrs { key РЅРѕРІРѕРіРѕ instance } Р‘Р•Р— p,
    //    С‚РµРєСЃС‚ вЂ” РґРµС„РѕР»С‚РЅР° РЅР°Р·РІР° РїРѕР»СЏ РЅРѕРІРѕРіРѕ instance
    let inserted = 0
    for (const chip of sourceChips) {
      const instance = nextInstance[chip.flavor]
      const key = `${chip.flavor}.${instance}.${chip.fieldType}`
      const targetParaId = paraByColumn.get(chip.columnIndex) ?? firstParaId
      if (!editor.exec({ type: "setSelection", anchor: { paraId: targetParaId } }).ok) {
        console.warn(LOG, "РєР°СЂРµС‚РєР° РЅРµ РїРѕСЃС‚Р°РІР»РµРЅР° РІ РЅРѕРІСѓ РєРѕРјС–СЂРєСѓ в†’", {
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
        console.warn(LOG, "insertCustomNode РЅРѕРІРѕРіРѕ С‡С–РїР° РІС–РґС…РёР»РµРЅРѕ в†’", {
          key,
          reason: result.reason,
        })
        continue
      }
      inserted += 1
    }
    console.info(LOG, "СЂРµ-РєР»СЋС‡РµРЅС– С‡С–РїРё РІСЃС‚Р°РІР»РµРЅС– в†’", { inserted, newInstance: nextInstance[primaryFlavor] })

    toast.success(
      `Р”РѕРґР°РЅРѕ Р»СЋРґРёРЅСѓ в„–${nextInstance[primaryFlavor] ?? 1}. РџСЂРёРІ'СЏР¶С–С‚СЊ РѕСЃРѕР±Сѓ РєРЅРѕРїРєРѕСЋ РЅР° С‡С–РїС–.`
    )
    return { ok: true, chipsInserted: inserted, newInstance: nextInstance[primaryFlavor] }
  } finally {
    suspendFieldSelect(false)
  }
}
