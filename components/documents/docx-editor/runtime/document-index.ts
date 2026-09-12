// DocumentIndex — актуальний індекс Custom Nodes документа.
//
// Джерела (тільки public API, editor — джерело істини):
//   - customNodesOf(editor) — перелік нод + attrs (key/flavor/instance/p);
//   - getReviewItems() → kind "custom" → item.range.start.paragraphId —
//     ЄДИНА надійна адреса абзаца чіна (DO-незалежна від каретки).
//
// Сталість: кеш тримається разом із package revision
// (editor.getDocumentHandle().revision) — будь-яке читання віддає індекс,
// перебудований під актуальну редакцію; застарілий кеш перебудовується
// автоматично при першому читанні (lazy refresh/rebuild).

import { customNodesOf } from "@docx-editor.dev/pro"
import type { DocxEditorInstance } from "@docx-editor.dev/core/editor"

import type { DocumentNode, NodeFlavor, NodeLocation, NodeLocationReason } from "./types"

// Схема identity персональних полів: staff.{i}.{f} / cadet.{i}.{f} —
// той самий формат, що FieldNode.fromDocx; тут НЕ новий парсер identity,
// а розбір СХЕМИ КЛЮЧА для обжив flavor/instance/fieldType.
const STAFF_CADET_KEY = /^(staff|cadet)\.([1-9]\d*)\.([a-zA-Z][a-zA-Z0-9_]*)$/

export class DocumentIndex {
  private readonly editor: DocxEditorInstance
  private cache: readonly DocumentNode[] | null = null
  private cacheRevision: number | null = null

  constructor(editor: DocxEditorInstance) {
    this.editor = editor
  }

  /** Актуальна редакція пакета (revision-гвард застарілого кеша). */
  private currentRevision(): number {
    try {
      return this.editor.getDocumentHandle().revision
    } catch {
      return 0
    }
  }

  private ensureFresh(): readonly DocumentNode[] {
    const revision = this.currentRevision()
    if (this.cache !== null && this.cacheRevision === revision) return this.cache
    return this.rebuild(revision)
  }

  /** Повне перебудування індексу з editor (public API only). */
  refresh(): readonly DocumentNode[] {
    return this.rebuild(this.currentRevision())
  }

  private rebuild(revision: number): readonly DocumentNode[] {
    // paragraphId/offset чіпа з review items: paragraphId — канонічний node id
    // абзаца-носія SDT (НЕ DocAnchor.paraId), offset — кінець діапазона
    // (каретка одразу ЗА контролом, поза SDT — як placeCaretBesideField)
    const rangeByNode = new Map<string, { paragraphId: string; offset: number }>()
    for (const entry of this.editor.getReviewItems()) {
      if (entry.kind !== "custom") continue
      const start = entry.item.range?.start ?? null
      const end = entry.item.range?.end ?? null
      if (start?.paragraphId) {
        rangeByNode.set(entry.item.id, {
          paragraphId: start.paragraphId,
          offset: end?.offset ?? start.offset,
        })
      }
    }

    const nodes: DocumentNode[] = []
    for (const node of customNodesOf(this.editor)) {
      const attrs = node.attrs as { key?: string; p?: string }
      const key = attrs.key ?? null
      // Flavor/instance/fieldType — розбір СХЕМИ key (не догадка: той самий
      // формат, що FieldNode.fromDocx читає при відкритті документа)
      const match = key !== null ? STAFF_CADET_KEY.exec(key) : null

      // paragraphId — з review items; без нього адреси немає (причина reason)
      const reviewed = node.nodeId != null ? (rangeByNode.get(node.nodeId) ?? null) : null
      const paragraphId = reviewed?.paragraphId ?? null
      const indexedReason: NodeLocationReason = paragraphId === null ? "no-review-range" : "no-anchor"
      const location: NodeLocation | null =
        paragraphId === null
          ? null
          : {
              paragraphId,
              paragraphOffset: reviewed?.offset ?? null,
              // Індекс БЕЗ якоря дає лише paragraphId; table/row/column
              // визначає locator за підтвердженим anchor (не тут)
              tableId: null,
              rowId: null,
              columnIndex: null,
            }

      nodes.push({
        nodeId: node.nodeId ?? "",
        tag: node.tag ?? "",
        key,
        flavor: match ? (match[1] as NodeFlavor) : "generic",
        fieldType: match ? match[3] : null,
        instance: match ? Number(match[2]) : null,
        entityId: attrs.p ?? null,
        location,
        locationReason: location === null ? "no-review-range" : indexedReason,
      })
    }
    this.cache = nodes
    this.cacheRevision = revision
    return nodes
  }

  /** Плоский список актуальних нод (без побудови — lazy). */
  nodes(): readonly DocumentNode[] {
    return this.ensureFresh()
  }

  node(nodeId: string): DocumentNode | null {
    return this.ensureFresh().find((node) => node.nodeId === nodeId) ?? null
  }

  findByKey(key: string): DocumentNode | null {
    return this.ensureFresh().find((node) => node.key === key) ?? null
  }

  findAllByKey(key: string): readonly DocumentNode[] {
    return this.ensureFresh().filter((node) => node.key === key)
  }

  findByFlavor(flavor: NodeFlavor): readonly DocumentNode[] {
    return this.ensureFresh().filter((node) => node.flavor === flavor)
  }

  findByInstance(flavor: NodeFlavor, instance: number): readonly DocumentNode[] {
    return this.ensureFresh().filter(
      (node) => node.flavor === flavor && node.instance === instance
    )
  }

  staff(instance: number): readonly DocumentNode[] {
    return this.findByInstance("staff", instance)
  }

  cadet(instance: number): readonly DocumentNode[] {
    return this.findByInstance("cadet", instance)
  }
}
