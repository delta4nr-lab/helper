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
import type {
  DocumentNode,
  NodeLocationResult,
  RowLocation,
  RowLocationResult,
  TableAnchor,
  TableLocation,
  TableLocationResult,
} from "./types"

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

/**
 * Канонічний id рушія: `part#a.b.c.…`. Top-level рядок таблиці має РІВНО
 * 4 числові сегменти (block.block.table.row) — лише тоді батьківську
 * таблицю можна вивести однозначно; глибші шляхи (вкладені таблиці)
 * не дають змоги відрізнити tbl від tc → derivation-unsupported.
 */
function topLevelRowTableId(rowId: string): string | null {
  const hash = rowId.indexOf("#")
  if (hash <= 0) return null
  const part = rowId.slice(0, hash)
  const segments = rowId.slice(hash + 1).split(".")
  if (segments.length !== 4) return null
  if (!segments.every((segment) => /^\d+$/.test(segment))) return null
  return `${part}#${segments.slice(0, 3).join(".")}`
}

/** Чи канонічний id має форму, придатну як tableId (part#a.b.c+). */
function isCanonicalTableId(tableId: string): boolean {
  const hash = tableId.indexOf("#")
  if (hash <= 0) return false
  const segments = tableId.slice(hash + 1).split(".")
  return segments.length >= 1 && segments.every((segment) => /^\d+$/.test(segment))
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
   * Рядок за канонічним rowId. tableId виводиться лише для однозначної
   * top-level форми (4 сегменти); інакше — частковий результат із
   * причиною (не вигадуємо батьківську таблицю).
   */
  row(rowId: string): RowLocationResult {
    const tableId = topLevelRowTableId(rowId)
    if (tableId === null) {
      return { ok: false, reason: "derivation-unsupported", rowId }
    }
    return { ok: true, location: { tableId, rowId } }
  }

  /**
   * Таблиця за canonical tableId: повертається нейтральна адреса
   * (rowId = null — рядок без якоря не виводиться). Наявність таблиці
   * публічним API не перевіряється (зафіксоване обмеження).
   */
  table(tableId: string): TableLocationResult {
    if (!isCanonicalTableId(tableId)) {
      return { ok: false, reason: "derivation-unsupported", tableId }
    }
    return { ok: true, location: { tableId, rowId: null } }
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

  /**
   * Рядок ноди — потребує підтвердженого якоря (рядок або таблиця),
   * бо depth канонічного id амбіквівалентен без початку таблиці.
   */
  findRowForNode(nodeId: string, anchor?: Partial<TableAnchor>): RowLocation | null {
    const located = this.nodeLocation(nodeId, anchor)
    if (!located.ok || located.location.rowId === null) return null
    return { tableId: located.location.tableId, rowId: located.location.rowId }
  }

  /** Таблиця ноди — також тільки з якорем (те саме обмеження). */
  findTableForNode(nodeId: string, anchor?: Partial<TableAnchor>): TableLocation | null {
    const located = this.nodeLocation(nodeId, anchor)
    if (!located.ok || located.location.rowId === null) return null
    return { tableId: located.location.tableId ?? null, rowId: located.location.rowId }
  }

  /** Порядок комірки ноди в рядку (cell ordinal). null без надійного якоря. */
  findColumnForNode(nodeId: string, anchor?: Partial<TableAnchor>): number | null {
    const located = this.nodeLocation(nodeId, anchor)
    return located.ok ? located.location.columnIndex : null
  }
}

export function createDocumentLocator(index: import("./document-index").DocumentIndex): DocumentLocator {
  return new DocumentLocator(index)
}
