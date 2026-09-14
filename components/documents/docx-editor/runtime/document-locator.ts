// DocumentLocator — визначає, ДЕ стоїть Custom Node.
//
// Публічні факти, на які ладиться Runtime (перевірено на 2.16.0):
//   1. paragraphId чіпа — getReviewItems() (ReviewCustomItem.range.start);
//   2. канонічні id рушія — ШЛЯХИ В ДЕРЕВІ: tableId = '…#0.0.8',
//      rowId = '…#0.0.8.3' (tbl → tr), абзац комірки = '…#0.0.8.3.2.1'
//      (tr → tc → p). Отже, за ПІДТВЕРДЖЕНИМ якорем rowId/tableId:
//        - чіп у рядку           ⇔ paraId.startsWith(rowId + ".");
//        - columnIndex (cell ord) = ПЕРШИЙ сегмент шляху після rowId;
//      це читання МОДЕЛІ, не догадка; воно не чіпає selection/caret.
//   3. Без якоря повносність адреси (table/row/column) НЕ гарантована:
//      depth сегментів канонічного id неоднозначний без знания початку
//      таблиці → повертаємо null + причину ("no-anchor"), не вгадуємо.
//
// ЗАБОРОНЕНІ підходи (за вимогами): setSelection-проби, current caret,
// пошук ПІБ, DOM як джерело, MutationObserver, string replacement.
//
// "columnIndex" тут — порядковий номер tc у рядку (cell ordinal); для
// таблиць без merged cells це збігається з grid-колонкою; для merged —
// engine вимагає окремий API (зафіксовано обмеження, не вигадуємо).

import type { DocumentIndex } from "./document-index"
import type { DocumentNode, NodeLocationResult, TableAnchor } from "./types"

/** Порядок комірки (tc) для paraId, коли відомий rowId: сегмент після рядка. */
export function cellOrdinalUnderRow(paragraphId: string, rowId: string): number | null {
  const prefix = `${rowId}.`
  if (!paragraphId.startsWith(prefix)) return null
  const remainder = paragraphId.slice(prefix.length)
  const firstSegment = remainder.split(".")[0] ?? ""
  const ordinal = Number(firstSegment)
  if (!Number.isInteger(ordinal) || ordinal < 0) return null
  return ordinal
}

/** Чи реде paraId лежить у сегменті рядка rowId. */
export function paragraphUnderRow(paragraphId: string, rowId: string): boolean {
  return paragraphId.startsWith(`${rowId}.`)
}

export class DocumentLocator {
  private readonly index: DocumentIndex

  constructor(index: DocumentIndex) {
    this.index = index
  }

  /** Нода з індексу (без адреси — для виклику згорнутих даних). */
  node(nodeId: string): DocumentNode | null {
    return this.index.node(nodeId)
  }

  /**
   * Адреса ноди. Без якоря повертає paragraphId + причину "no-anchor":
   * tableId/rowId/columnIndex = null (НЕ вигадує значення).
   */
  nodeLocation(nodeId: string, anchor?: Partial<TableAnchor>): NodeLocationResult {
    const node = this.index.node(nodeId)
    if (!node) return { ok: false, reason: "unknown-node" }
    const paragraphId = node.location?.paragraphId ?? null
    if (!paragraphId) return { ok: false, reason: "no-review-range", paragraphId: null }
    const paragraphOffset = node.location?.paragraphOffset ?? null

    // 1) Явний якір рядка: перевірка префікса шляху
    if (anchor?.rowId) {
      if (!paragraphUnderRow(paragraphId, anchor.rowId)) {
        return { ok: false, reason: "anchor-mismatch", paragraphId }
      }
      const ordinal = cellOrdinalUnderRow(paragraphId, anchor.rowId)
      if (ordinal === null) return { ok: false, reason: "anchor-mismatch", paragraphId }
      return {
        ok: true,
        location: {
          paragraphId,
          paragraphOffset,
          tableId: anchor.tableId ?? null,
          rowId: anchor.rowId,
          columnIndex: ordinal,
        },
      }
    }

    // 2) Якор таблиці рядка із шляхом paraId: tableId → [row, cell, …]
    if (anchor?.tableId) {
      const prefix = `${anchor.tableId}.`
      if (!paragraphId.startsWith(prefix)) {
        return { ok: false, reason: "anchor-mismatch", paragraphId }
      }
      const segments = paragraphId.slice(prefix.length).split(".")
      const rowSegment = segments[0]
      const cellOrdinal = Number(segments[1] ?? "")
      if (
        rowSegment === undefined ||
        !/^\d+$/.test(rowSegment) ||
        !Number.isInteger(cellOrdinal) ||
        cellOrdinal < 0
      ) {
        return { ok: false, reason: "anchor-mismatch", paragraphId }
      }
      return {
        ok: true,
        location: {
          paragraphId,
          paragraphOffset,
          tableId: anchor.tableId,
          rowId: `${anchor.tableId}.${rowSegment}`,
          columnIndex: cellOrdinal,
        },
      }
    }

    // 3) Без якоря — тільки paragraphId
    return { ok: false, reason: "no-anchor", paragraphId }
  }
}
