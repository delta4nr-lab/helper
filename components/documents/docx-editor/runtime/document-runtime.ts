// DocumentRuntime v1 — фасад над editor (@docx-editor.dev core/react/pro).
//
// Мета: UI-компоненти в майбутньому не працюють напряму з getReviewItems(),
// customNodesOf(), selection, tableContext, layout або DOM — уся
// низькорівнева робота з editor API концентрується тут.
//
// Editor — ДЖЕРЕЛО ІСТИНИ. Runtime не дублює DOCX модель; він
// індексує та інтерпретує документ (public API only):
//   - index     — актуальні Custom Nodes (revision-guard кеш);
//   - locator   — адреса ноди: paragraphId завжди; table/row/column
//                 ТІЛЬКИ за підтвердженим якорем (canonical id path);
//   - nodes     — read-only менеджер чіпів;
//   - tables    — read-only менеджер таблиць (duplicateRow — пізніше);
//   - transaction — обгортка майбутніх складних дій (без фейкового undo);
//   - debug()   — dev-only діагностика (console.table з причин null-ів).

import { DocumentIndex } from "./document-index"
import { DocumentLocator } from "./document-locator"
import { DocumentNodeManager } from "./node-manager"
import { DocumentTableManager } from "./table-manager"
import { RuntimeTransaction } from "./transaction"
import type { DocxEditorInstance } from "@docx-editor.dev/core/editor"
import type { DocumentNode, DocumentNodeDebug } from "./types"

export class DocumentRuntime {
  private readonly editor: DocxEditorInstance

  readonly index: DocumentIndex
  readonly locator: DocumentLocator
  readonly nodes: DocumentNodeManager
  readonly tables: DocumentTableManager
  readonly transaction: RuntimeTransaction

  constructor(editor: DocxEditorInstance) {
    this.editor = editor
    this.index = new DocumentIndex(editor)
    this.locator = new DocumentLocator(this.index)
    this.nodes = new DocumentNodeManager(this.index)
    this.tables = new DocumentTableManager(this.index, this.locator)
    this.transaction = new RuntimeTransaction(editor)
  }

  /** Повне перебудування індексу під актуальну редакцію документа. */
  refresh(): readonly DocumentNode[] {
    return this.index.refresh()
  }

  /**
   * Dev-only діагностика: таблиця всіх Custom Nodes із location.
   * Поле, яке неможливо надійно визначити, — null + reason.
   * anchor — необов'язковий контекст (наприклад, engine furniture
   * dataset останнього рядка); без якоря column/row = null.
   */
  debug(anchor?: { tableId?: string | null; rowId?: string | null }): readonly DocumentNodeDebug[] {
    const rows = this.index.nodes().map((node): DocumentNodeDebug => {
      const paragraphId = node.location?.paragraphId ?? null
      if (paragraphId === null) {
        return {
          nodeId: node.nodeId,
          key: node.key,
          flavor: node.flavor,
          instance: node.instance,
          fieldType: node.fieldType,
          paragraphId: null,
          tableId: null,
          rowId: null,
          columnIndex: null,
          reason: "no-review-range",
        }
      }
      const anchorArg =
        anchor?.tableId || anchor?.rowId
          ? { tableId: anchor.tableId ?? undefined, rowId: anchor.rowId ?? undefined }
          : undefined
      const located = this.locator.nodeLocation(node.nodeId, anchorArg)
      if (!located.ok) {
        return {
          nodeId: node.nodeId,
          key: node.key,
          flavor: node.flavor,
          instance: node.instance,
          fieldType: node.fieldType,
          paragraphId,
          tableId: null,
          rowId: null,
          columnIndex: null,
          reason: `${located.reason}${located.reason === "no-anchor" ? "" : ` (${paragraphId})`}`,
        }
      }
      return {
        nodeId: node.nodeId,
        key: node.key,
        flavor: node.flavor,
        instance: node.instance,
        fieldType: node.fieldType,
        paragraphId: located.location.paragraphId,
        tableId: located.location.tableId,
        rowId: located.location.rowId,
        columnIndex: located.location.columnIndex,
        reason: null,
      }
    })

    if (typeof window !== "undefined") {
      console.groupCollapsed(`[docx-runtime] custom nodes: ${rows.length}`)
      console.table(rows)
      console.groupEnd()
    }
    return rows
  }
}
