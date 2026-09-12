// TableManager — read-only абстракція таблиць для Runtime v1 v1.
//
// Джерела: лише підтверджені якори (engine furniture dataset: tableId/
// rowId) + індекс нод (canonical id path). Под duplicateRow тут ЕФ不来
// — це майбутня робота через Runtime transaction (існуюча логіка
// table-row-duplicate залишається як є).
//
// ЗАБОРОНЕНІ підходи: DOM cloning, innerHTML, MutationObserver,
// setSelection-прос, caret-фолбеки, string replacement.

import type { DocumentIndex } from "./document-index"
import type { DocumentLocator } from "./document-locator"
import { cellOrdinalUnderRow, paragraphUnderRow } from "./document-locator"
import type {
  DocumentNode,
  RowLocation,
  RowLocationResult,
  TableAnchor,
  TableLocationResult,
} from "./types"

export class DocumentTableManager {
  private readonly index: DocumentIndex
  private readonly locator: DocumentLocator

  constructor(index: DocumentIndex, locator: DocumentLocator) {
    this.index = index
    this.locator = locator
  }

  /**
   * Таблиця за canonical tableId: нейтральна адреса (rowId = null —
   * рядок без якоря не виводимо). Наявність таблиці публічно не
   * перевіряється (зафіксоване обмеження).
   */
  getTable(tableId: string): TableLocationResult {
    return this.locator.table(tableId)
  }

  /**
   * Рядок за canonical rowId: tableId виводиться лише для однозначної
   * top-level форми (4 сегменти); інакше частковий результат + причина
   * "derivation-unsupported" (не вигадуємо).
   */
  getRow(rowId: string): RowLocationResult {
    return this.locator.row(rowId)
  }

  /** Рядок, у якому стоїть нода (requirement по ипп支持уявленню якоря). */
  findRowForNode(nodeId: string, anchor: Partial<TableAnchor>): RowLocation | null {
    return this.locator.findRowForNode(nodeId, anchor)
  }

  /**
   * Ноди рядка: paraId чіна префіксно входить у rowId
   * ('…#0.0.8.3' ⊂ '…#0.0.8.3.2.1') — читання моделі, без каретки.
   */
  getNodesInRow(rowId: string): readonly DocumentNode[] {
    return this.index
      .nodes()
      .filter(
        (node) => node.location !== null && paragraphUnderRow(node.location.paragraphId, rowId || "")
      )
      .map((node) => node)
  }

  /** Ноди комірки (cell ordinal у рядку; ≠ grid column для merged cells). */
  getNodesInColumn(rowId: string, columnIndex: number): readonly DocumentNode[] {
    return this.getNodesInRow(rowId).filter((node) => {
      const paragraphId = node.location?.paragraphId ?? null
      return paragraphId !== null && cellOrdinalUnderRow(paragraphId, rowId) === columnIndex
    })
  }
}

export function createTableManager(index: DocumentIndex, locator: DocumentLocator): DocumentTableManager {
  return new DocumentTableManager(index, locator)
}
