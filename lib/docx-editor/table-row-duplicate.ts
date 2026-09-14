// Повторювані рядки таблиці (full-clone).
//
// ДЖЕРЕЛО СТРУКТУРИ — LIVE template row: найверхніший w:tr групи
// (tableId + repeatId). Копіюємо ВЕСЬ вміст комірок (усі абзаци, переноси,
// нумерацію, вкладені таблиці, форматування) через public insertFragment
// (block kinds paragraph|table|contentControl), який вставляє блоки в w:tc і
// сам перепризначає всі node id. У копії змінюємо лише наші FieldNode
// (новий instance + плейсхолдер-назва, unbound, без p/dataBinding) і
// прибираємо старий RepeatRowMarker.
//
// DATA (БД): entityId використовується ЛИШЕ для identity/вибору рядка.
// Кожен рядок групи має `e=<entityId>` у thin marker; next = перший DB-запис,
// чий entityId не використаний у групі (tableId + repeatId). Значення полів у
// чіпи не підставляються (користувач прив'язує/заповнює сам).
//
// Уся робота з canonical tree — через public editor.surface.session.part();
// зміни — через public editor.surface.applyAutomationOps (layout-safe).
// Без DOM, без caret, без setSelection-probe, без rowId-арифметики.

import { customNodesOf, insertCustomNode, updateCustomNode } from "@docx-editor.dev/pro"
import { toast } from "sonner"

import { resolvePersonField } from "@/components/documents/docx-editor/personnel-picker"
import { suspendFieldSelect } from "@/components/documents/docx-editor/field-select"
import { PERSONNEL_FIELD_LABELS } from "@/components/documents/docx-editor/personnel-panel"
import { COURSE_FIELD_LABELS } from "@/lib/courses/types"
import { type FieldChipAttrs } from "@/lib/docx-editor/field-node"
import {
  generateRepeatId,
  REPEAT_REGISTRY_ATTR,
  REPEAT_REGISTRY_VALUE,
  REPEAT_ROW_TAG_PREFIX,
  RepeatRowMarker,
  RepeatRowRegistry,
  repeatRegistrySchema,
  repeatRowSchema,
  type RepeatDataSource,
  type RepeatRowDefinition,
} from "@/lib/docx-editor/repeat-row"
import {
  listRepeatRows,
  type RepeatSourceContext,
} from "@/lib/docx-editor/repeat-data"

const LOG = "[table-row-duplicate]"

// ── Canonical tree (structural shape) ──────────────────────────────────────

type OAttr = {
  localName: string
  value: string
  namespaceUri?: string
  prefix?: string
  kind?: string
}

type ONode = {
  id?: string
  kind?: string
  localName?: string
  namespaceUri?: string
  prefix?: string
  namespaceBindings?: unknown
  attributes?: OAttr[]
  children?: ONode[]
  /** textValue */
  value?: string
}

function isElement(node: ONode): boolean {
  return typeof node.localName === "string" && Array.isArray(node.children)
}

function elementChildren(node: ONode): ONode[] {
  return (node.children ?? []).filter(isElement)
}

function directRows(table: ONode): ONode[] {
  return elementChildren(table).filter((child) => child.localName === "tr")
}

function directCells(row: ONode): ONode[] {
  return elementChildren(row).filter((child) => child.localName === "tc")
}

function directParagraphs(cell: ONode): ONode[] {
  return elementChildren(cell).filter((child) => child.localName === "p")
}

function bodyRoot(editor: EditorLike): ONode | null {
  const session = editor.surface?.session
  if (!session) return null
  return (session.part().root as unknown as ONode) ?? null
}

function findChild(node: ONode, localName: string): ONode | undefined {
  return elementChildren(node).find((child) => child.localName === localName)
}

function findDescendant(node: ONode, localName: string): ONode | undefined {
  for (const child of elementChildren(node)) {
    if (child.localName === localName) return child
    const nested = findDescendant(child, localName)
    if (nested) return nested
  }
  return undefined
}

// ── Tag decode ─────────────────────────────────────────────────────────────

function sdtTagValue(sdt: ONode): string | null {
  const sdtPr = findChild(sdt, "sdtPr")
  if (!sdtPr) return null
  const tag = findChild(sdtPr, "tag")
  return tag?.attributes?.find((a) => a.localName === "val")?.value ?? null
}

function decodeTagAttrs(tag: string): Record<string, string> {
  const q = tag.indexOf("?")
  if (q === -1) return {}
  const attrs: Record<string, string> = {}
  for (const part of tag.slice(q + 1).split("&")) {
    const eq = part.indexOf("=")
    if (eq <= 0) continue
    attrs[part.slice(0, eq)] = decodeURIComponent(part.slice(eq + 1))
  }
  return attrs
}

function decodeRepeatMarkerTag(tag: string): { repeatId: string; entityId: string | null } | null {
  if (!tag.startsWith(`${REPEAT_ROW_TAG_PREFIX}:row`) && !tag.startsWith("acme:repeatRow")) {
    return null
  }
  const attrs = decodeTagAttrs(tag)
  const repeatId = attrs["r"]
  if (!repeatId) return null
  return { repeatId, entityId: attrs["e"] ?? null }
}

function decodeFieldTag(tag: string): string | null {
  if (!tag.startsWith("acme:field")) return null
  const attrs = decodeTagAttrs(tag)
  return attrs["k"] ?? attrs["key"] ?? null
}

// ── Marker / Registry ──────────────────────────────────────────────────────

type MarkerHit = { rowId: string; repeatId: string; entityId: string | null }

function readMarkersInRow(row: ONode): MarkerHit[] {
  const hits: MarkerHit[] = []
  for (const cell of directCells(row)) {
    for (const paragraph of directParagraphs(cell)) {
      for (const child of elementChildren(paragraph)) {
        if (child.localName !== "sdt") continue
        const tag = sdtTagValue(child)
        if (!tag) continue
        const decoded = decodeRepeatMarkerTag(tag)
        if (!decoded) continue
        hits.push({ rowId: row.id ?? "", repeatId: decoded.repeatId, entityId: decoded.entityId })
      }
    }
  }
  return hits
}

function findMarkerForRow(tableId: string, rowId: string, root: ONode): MarkerHit | null {
  const table = findById(root, tableId)
  if (!table || table.localName !== "tbl") return null
  const row = directRows(table).find((candidate) => candidate.id === rowId)
  if (!row) return null
  return readMarkersInRow(row)[0] ?? null
}

/** Template row = найверхніший w:tr групи repeatId (document order). */
function findTemplateRow(table: ONode, repeatId: string): ONode | null {
  for (const row of directRows(table)) {
    if (readMarkersInRow(row).some((hit) => hit.repeatId === repeatId)) return row
  }
  return null
}

/** `e` усіх рядків групи (repeatId) у конкретній таблиці + фізичний порядок. */
function collectGroupMarkers(
  table: ONode,
  repeatId: string
): { rowOrder: string[]; usedEntityIds: Set<string> } {
  const rowOrder: string[] = []
  const usedEntityIds = new Set<string>()
  for (const row of directRows(table)) {
    const hit = readMarkersInRow(row).find((m) => m.repeatId === repeatId)
    if (!hit) continue
    rowOrder.push(row.id ?? "")
    if (hit.entityId) usedEntityIds.add(hit.entityId)
  }
  return { rowOrder, usedEntityIds }
}

function readRegistry(
  editor: EditorLike
): { nodeId: string; definitions: Record<string, RepeatRowDefinition> } | null {
  for (const node of customNodesOf(editor, { nodes: [RepeatRowRegistry] })) {
    const nodeId = node.nodeId ?? ""
    if (!nodeId) continue
    const parsed = repeatRegistrySchema.safeParse(node.data)
    if (!parsed.success) continue
    return { nodeId, definitions: parsed.data.definitions }
  }
  return null
}

function readDefinition(editor: EditorLike, repeatId: string): RepeatRowDefinition | null {
  const registry = readRegistry(editor)
  if (!registry) return null
  const parsed = repeatRowSchema.safeParse(registry.definitions[repeatId])
  return parsed.success ? parsed.data : null
}

function lastBodyParagraph(root: ONode): ONode | null {
  const body = findChild(root, "body") ?? root
  const paragraphs = elementChildren(body).filter((child) => child.localName === "p")
  return paragraphs.length > 0 ? paragraphs[paragraphs.length - 1]! : null
}

function upsertRegistry(editor: EditorLike, definition: RepeatRowDefinition): boolean {
  const registry = readRegistry(editor)
  const nextDefs = {
    definitions: { ...(registry?.definitions ?? {}), [definition.repeatId]: definition },
  }
  if (registry) {
    const updated = updateCustomNode(editor, RepeatRowRegistry, registry.nodeId, {
      data: nextDefs,
      text: " ",
    })
    if (!updated.ok) {
      console.warn(LOG, "updateCustomNode(RepeatRowRegistry) відхилено →", {
        reason: updated.reason,
      })
      return false
    }
    return true
  }
  const root = bodyRoot(editor)
  const target = root ? lastBodyParagraph(root) : null
  if (!target) {
    console.warn(LOG, "немає body-абзацу для registry")
    return false
  }
  const created = insertCustomNode(editor, RepeatRowRegistry, {
    at: { paragraphId: target.id ?? "", offset: 0 },
    attrs: { [REPEAT_REGISTRY_ATTR]: REPEAT_REGISTRY_VALUE },
    text: " ",
    data: nextDefs,
    lock: false,
  })
  if (!created.ok) {
    console.warn(LOG, "insertCustomNode(RepeatRowRegistry) відхилено →", {
      reason: created.reason,
    })
    return false
  }
  return true
}

// ── Chips ──────────────────────────────────────────────────────────────────

type EditorLike = Parameters<typeof resolvePersonField>[0]
type CustomNodeRef = Parameters<typeof resolvePersonField>[1]

function chipParagraphId(editor: EditorLike, nodeId: string): string | null {
  for (const entry of editor.getReviewItems()) {
    if (entry.kind !== "custom" || entry.item.id !== nodeId) continue
    return entry.item.range?.start?.paragraphId ?? null
  }
  return null
}

function flavorOfRow(editor: EditorLike, row: ONode): "staff" | "cadet" | null {
  const paragraphIds = new Set<string>()
  for (const cell of directCells(row)) {
    for (const paragraph of directParagraphs(cell)) {
      if (paragraph.id) paragraphIds.add(paragraph.id)
    }
  }
  for (const node of customNodesOf(editor)) {
    const info = resolvePersonField(editor, node as unknown as CustomNodeRef)
    if (!info) continue
    const attrs = node.attrs as FieldChipAttrs
    if (!attrs.key) continue
    const nodeId = node.nodeId ?? ""
    const paragraphId = nodeId ? chipParagraphId(editor, nodeId) : null
    if (paragraphId && paragraphIds.has(paragraphId)) return info.flavor
  }
  return null
}

function maxInstanceForFlavor(editor: EditorLike, flavor: "staff" | "cadet"): number {
  let max = 0
  for (const node of customNodesOf(editor)) {
    const info = resolvePersonField(editor, node as unknown as CustomNodeRef)
    if (!info || info.flavor !== flavor) continue
    max = Math.max(max, info.instance)
  }
  return max
}

function dataSourceForFlavor(flavor: "staff" | "cadet"): RepeatDataSource {
  return flavor === "staff" ? "personnel" : "course"
}

// ── Clone + transform ──────────────────────────────────────────────────────

type FieldRewriteCtx = {
  readonly personInstance: number
}

/** Людська назва поля для плейсхолдера нового (unbound) чіпа. */
function fieldLabelFor(flavor: "staff" | "cadet", fieldType: string): string {
  if (flavor === "staff") {
    return PERSONNEL_FIELD_LABELS[fieldType as keyof typeof PERSONNEL_FIELD_LABELS] ?? fieldType
  }
  return COURSE_FIELD_LABELS[fieldType as keyof typeof COURSE_FIELD_LABELS] ?? fieldType
}

function setSdtTag(sdt: ONode, newTag: string): void {
  const sdtPr = findChild(sdt, "sdtPr")
  if (!sdtPr) return
  const tag = findChild(sdtPr, "tag")
  const attr = tag?.attributes?.find((a) => a.localName === "val")
  if (attr) attr.value = newTag
}

function setSdtText(sdt: ONode, value: string): void {
  const content = findChild(sdt, "sdtContent")
  if (!content) return
  const t = findDescendant(content, "t")
  const textValue = t?.children?.find((child) => child.kind === "textValue")
  if (textValue) textValue.value = value
}

/**
 * Переписує FieldNode у клоні: новий instance key + плейсхолдер-назва
 * (`ПІБ (2)`), без `p` — нові поля лишаються unbound. Значення з БД тут НЕ
 * підставляються (користувач прив'язує/заповнює сам).
 */
function rewriteFieldSdt(sdt: ONode, key: string, ctx: FieldRewriteCtx): boolean {
  const m = /^(staff|cadet)\.[1-9][0-9]*\.([a-zA-Z][a-zA-Z0-9_]*)$/.exec(key)
  if (!m) return false
  const flavor = m[1] as "staff" | "cadet"
  const fieldType = m[2]!
  setSdtTag(sdt, `acme:field?k=${flavor}.${ctx.personInstance}.${fieldType}`)
  setSdtText(sdt, `${fieldLabelFor(flavor, fieldType)} (${ctx.personInstance})`)
  return true
}

/**
 * Рекурсивно трансформує клон блоку: видаляє RepeatRowMarker, переписує
 * FieldNode. Повертає null, якщо вузол треба прибрати.
 */
function transformClone(node: ONode, ctx: FieldRewriteCtx): ONode | null {
  if (node.kind === "textValue") return node
  const tag = node.localName === "sdt" ? sdtTagValue(node) : null
  if (tag) {
    if (decodeRepeatMarkerTag(tag)) return null
    const key = decodeFieldTag(tag)
    if (key && rewriteFieldSdt(node, key, ctx)) return node
  }
  const next: ONode[] = []
  for (const child of node.children ?? []) {
    const transformed = transformClone(child, ctx)
    if (transformed) next.push(transformed)
  }
  node.children = next
  return node
}

/** Block-level діти комірки, придатні для insertFragment (p|tbl|sdt). */
function clonableBlocks(cell: ONode): ONode[] {
  return elementChildren(cell).filter(
    (child) => child.localName === "p" || child.localName === "tbl" || child.localName === "sdt"
  )
}

function isEmptyParagraph(paragraph: ONode): boolean {
  for (const child of paragraph.children ?? []) {
    if (child.kind === "textValue") {
      if ((child.value ?? "").trim().length > 0) return false
      continue
    }
    if (child.localName === "pPr") continue
    return false
  }
  return true
}

// ── Outcomes ───────────────────────────────────────────────────────────────

export type DuplicateRowOutcome =
  | { readonly intercept: false }
  | { readonly intercept: true; readonly ok: true }
  | {
      readonly intercept: true
      readonly ok: false
      readonly reason:
        | "insert-refused"
        | "no-new-row"
        | "structure-mismatch"
        | "no-data"
        | "marker-no-definition"
        | "no-template"
    }

export type CreateRepeatRowOutcome =
  | { readonly ok: true; readonly repeatId: string }
  | {
      readonly ok: false
      readonly reason: "no-custom-nodes" | "already-repeatable" | "insert-refused" | "no-paragraph"
    }

function documentRevision(editor: EditorLike): number {
  try {
    return editor.getDocumentHandle().revision
  } catch {
    return -1
  }
}

function findById(root: ONode, id: string): ONode | null {
  if (root.id === id) return root
  for (const child of elementChildren(root)) {
    const found = findById(child, id)
    if (found) return found
  }
  return null
}

// ── ADMIN ──────────────────────────────────────────────────────────────────

export function createRepeatRow(
  editor: EditorLike,
  tableId: string,
  rowId: string
): CreateRepeatRowOutcome {
  if (!editor || !tableId || !rowId) return { ok: false, reason: "no-custom-nodes" }
  const root = bodyRoot(editor)
  if (!root) return { ok: false, reason: "no-custom-nodes" }

  if (findMarkerForRow(tableId, rowId, root)) {
    return { ok: false, reason: "already-repeatable" }
  }

  const table = findById(root, tableId)
  const row = table ? directRows(table).find((candidate) => candidate.id === rowId) : null
  if (!table || !row) return { ok: false, reason: "no-custom-nodes" }
  const flavor = flavorOfRow(editor, row)
  if (!flavor) return { ok: false, reason: "no-custom-nodes" }

  const existingIds = new Set(
    customNodesOf(editor, { nodes: [RepeatRowMarker] })
      .map((node) => (node.attrs as { r?: string }).r)
      .filter((value): value is string => typeof value === "string")
  )
  let repeatId = generateRepeatId()
  for (let attempt = 0; existingIds.has(repeatId) && attempt < 8; attempt += 1) {
    repeatId = generateRepeatId()
  }

  const definition: RepeatRowDefinition = {
    repeatId,
    flavor,
    markerCellIndex: 0,
    dataSource: dataSourceForFlavor(flavor),
  }

  suspendFieldSelect(true)
  try {
    if (!upsertRegistry(editor, definition)) return { ok: false, reason: "insert-refused" }

    const targetCell = directCells(row)[definition.markerCellIndex]
    const targetParagraph = targetCell ? (directParagraphs(targetCell)[0] ?? null) : null
    if (!targetParagraph) return { ok: false, reason: "no-paragraph" }

    // Thin marker БЕЗ `e` (легасі): відповідність шаблонного рядка DB-запису
    // достовірно невідома.
    const result = insertCustomNode(editor, RepeatRowMarker, {
      at: { paragraphId: targetParagraph.id ?? "", offset: 0 },
      attrs: { r: repeatId },
      text: " ",
      lock: false,
    })
    if (!result.ok) {
      console.warn(LOG, "insertCustomNode(RepeatRowMarker) відхилено →", {
        repeatId,
        reason: result.reason,
      })
      return { ok: false, reason: "insert-refused" }
    }
    return { ok: true, repeatId }
  } finally {
    suspendFieldSelect(false)
  }
}

// ── USER ───────────────────────────────────────────────────────────────────

export function duplicateTableRow(
  editor: EditorLike,
  tableId: string,
  rowId: string,
  ctx: RepeatSourceContext
): DuplicateRowOutcome {
  if (!editor || !tableId || !rowId) return { intercept: false }

  const root = bodyRoot(editor)
  if (!root) return { intercept: false }
  const table = findById(root, tableId)
  if (!table || table.localName !== "tbl") return { intercept: false }
  const rowsBefore = directRows(table)
  if (!rowsBefore.some((row) => row.id === rowId)) return { intercept: false }

  const marker = findMarkerForRow(tableId, rowId, root)
  if (!marker) return { intercept: false }
  const definition = readDefinition(editor, marker.repeatId)
  if (!definition) {
    console.warn(LOG, "definition не знайдено в registry →", { repeatId: marker.repeatId })
    toast.error("Структуру повторюваного рядка не знайдено.")
    return { intercept: true, ok: false, reason: "marker-no-definition" }
  }

  const templateRow = findTemplateRow(table, marker.repeatId)
  if (!templateRow) {
    toast.error("Шаблонний рядок групи не знайдено.")
    return { intercept: true, ok: false, reason: "no-template" }
  }

  // Наступний DB-запис: перший, чий entityId не використаний у групі.
  const group = collectGroupMarkers(table, marker.repeatId)
  const candidates = listRepeatRows(definition.dataSource, ctx)
  let dataRow = candidates.find((candidate) => !group.usedEntityIds.has(candidate.entityId)) ?? null
  if (!dataRow && group.usedEntityIds.size === 0) {
    const rowIndex = group.rowOrder.findIndex((id) => id === rowId)
    dataRow = candidates[rowIndex] ?? null
  }
  if (!dataRow) {
    toast.warning("Немає даних для наступного рядка.")
    return { intercept: true, ok: false, reason: "no-data" }
  }

  const flavor = definition.flavor
  const personInstance = maxInstanceForFlavor(editor, flavor) + 1
  const beforeRowIds = new Set(rowsBefore.map((row) => row.id))

  suspendFieldSelect(true)
  try {
    const sourceRevision = documentRevision(editor)
    if (sourceRevision < 0) {
      toast.error("Не вдалося визначити редакцію документа. Спробуйте ще раз.")
      return { intercept: true, ok: false, reason: "insert-refused" }
    }

    const insertCommand = {
      type: "insertRow" as const,
      where: "below" as const,
      target: { tableId, rowId, sourceRevision, isHeaderRepeat: false },
    }
    const can = editor.can(insertCommand)
    if (!can.ok) {
      console.warn(LOG, "targeted insertRow відхилено can() →", can.reason)
      toast.error("Не вдалося додати рядок після цього рядка. Спробуйте ще раз.")
      return { intercept: true, ok: false, reason: "insert-refused" }
    }
    const insert = editor.exec(insertCommand)
    if (!insert.ok) {
      console.warn(LOG, "targeted insertRow відхилено exec() →", insert.reason)
      toast.error("Не вдалося додати рядок. Спробуйте ще раз.")
      return { intercept: true, ok: false, reason: "insert-refused" }
    }

    const rootAfter = bodyRoot(editor)
    const tableAfter = rootAfter ? findById(rootAfter, tableId) : null
    if (!tableAfter) {
      toast.warning("Рядок вставлено, але нові поля не вдалося створити автоматично.")
      return { intercept: true, ok: false, reason: "no-new-row" }
    }
    const newRows = directRows(tableAfter).filter((row) => !beforeRowIds.has(row.id))
    if (newRows.length !== 1) {
      console.warn(LOG, "новий w:tr не визначено однозначно →", { candidates: newRows.length })
      toast.warning("Рядок вставлено, але нові поля не вдалося створити автоматично.")
      return { intercept: true, ok: false, reason: "no-new-row" }
    }
    const newRow = newRows[0]!
    const templateCells = directCells(templateRow)
    const newCells = directCells(newRow)

    // Один insertFragment на комірку: повний клон block-вмісту template cell.
    const rewriteCtx: FieldRewriteCtx = { personInstance }
    const fragmentOps: Record<string, unknown>[] = []
    for (let i = 0; i < templateCells.length && i < newCells.length; i += 1) {
      const blocks = clonableBlocks(templateCells[i]!)
      if (blocks.length === 0) continue
      const cloned: ONode[] = []
      for (const block of blocks) {
        const transformed = transformClone(structuredClone(block) as ONode, rewriteCtx)
        if (transformed) cloned.push(transformed)
      }
      if (cloned.length === 0) continue
      const anchor = directParagraphs(newCells[i]!)[0]
      if (!anchor?.id) continue
      fragmentOps.push({
        op: "insertFragment",
        paragraphId: anchor.id,
        offset: 0,
        blocks: cloned,
        lastMarkCovered: true,
      })
    }

    const surface = editor.surface
    if (!surface || fragmentOps.length === 0) {
      toast.error("Не вдалося скопіювати вміст рядка.")
      return { intercept: true, ok: false, reason: "structure-mismatch" }
    }

    const inserted = surface.applyAutomationOps(() => fragmentOps as never)
    if (!inserted.committed) {
      console.warn(LOG, "insertFragment відхилено →", { reason: inserted.reason })
      toast.error("Не вдалося скопіювати вміст рядка.")
      return { intercept: true, ok: false, reason: "structure-mismatch" }
    }

    // Прибираємо справді порожні залишкові абзаци (двигун не чистить якір).
    const rootClean = bodyRoot(editor)
    const tableClean = rootClean ? findById(rootClean, tableId) : null
    const cleanRow = tableClean
      ? directRows(tableClean).find((row) => row.id === newRow.id)
      : null
    const deleteOps: Record<string, unknown>[] = []
    if (cleanRow) {
      for (const cell of directCells(cleanRow)) {
        const paragraphs = directParagraphs(cell)
        const empties = paragraphs.filter(isEmptyParagraph)
        const deletable = Math.max(0, empties.length - Math.max(0, 1 - (paragraphs.length - empties.length)))
        for (let i = 0; i < deletable; i += 1) {
          const paragraph = empties[i]
          if (!paragraph?.id) continue
          deleteOps.push({ op: "deleteBlock", blockId: paragraph.id })
        }
      }
    }
    if (deleteOps.length > 0) {
      surface.applyAutomationOps(() => deleteOps as never)
    }

    // Новий thin marker у marker-комірці.
    const markerCell = directCells(cleanRow ?? newRow)[definition.markerCellIndex]
    const markerParagraph = markerCell ? (directParagraphs(markerCell)[0] ?? null) : null
    if (markerParagraph?.id) {
      const markerResult = insertCustomNode(editor, RepeatRowMarker, {
        at: { paragraphId: markerParagraph.id, offset: 0 },
        attrs: { r: definition.repeatId, e: dataRow.entityId },
        text: " ",
        lock: false,
      })
      if (!markerResult.ok) {
        console.warn(LOG, "копію RepeatRowMarker не вставлено →", {
          reason: markerResult.reason,
        })
      }
    }

    toast.success(`Додано людину №${personInstance}.`)
    return { intercept: true, ok: true }
  } finally {
    suspendFieldSelect(false)
  }
}
