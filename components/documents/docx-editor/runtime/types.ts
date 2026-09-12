// Базові типи Document Runtime v1.
//
// Runtime НЕ дублює DOCX модель — він зберігає ТІЛЬКИ інформацію,
// необхідну бізнес-логіці (custom nodes + їхнє місце в документі).
// Editor залишається джерелом істини; runtime лише індексує/інтерпретує.
//
// Правила location (критично):
// - paragraphId — ЄДИНА завжди-надійна частина адреси (public API:
//   getReviewItems() → ReviewCustomItem.range.start.paragraphId);
// - tableId/rowId/columnIndex визначаються ТІЛЬКИ коли є підтверджений
//   якір (engine-furniture dataset tableId/rowId або явний виклик
//   з контекстом): канонічні id рушія — шляхи в дереві, і paraId чіпа
//   префіксно входить у rowId ('/…#0.0.8.3' ⊂ '/…#0.0.8.3.2.1');
// - якщо якоря немає — location.tempose tableId/rowId/columnIndex null
//   з причиною; НЕ вигадуємо значень, не чіпаємо каретку.

export type NodeFlavor = "staff" | "cadet" | "generic"

/** Чому location не може бути визначена повністю (структурована причина). */
export type NodeLocationReason =
  /** Нода не має review-range (layout ще не розв'язав позицію) */
  | "no-review-range"
  /** Немає підтвердженого якоря таблиці/рядка для читання шляху */
  | "no-anchor"
  /** Шлях paraId не збігається з якорем (структура не як очікувалось) */
  | "anchor-mismatch"
  /** nodeId не знайдено в індексі */
  | "unknown-node"
  /**
   * Похідну адресу не можна вивести з канонічного id без якоря
   * (неоднозначна форма шляху — напр., рядок вкладеної таблиці)
   */
  | "derivation-unsupported"

export type NodeLocation = {
  /** Стабільний абзац чіпа завжди відомий (з review items) */
  readonly paragraphId: string
  /**
   * Offset кінця review-діапазону в цьому абзаці (канонічний id простір
   * EditorPosition) — точка вставки одразу ЗА SDT; null, якщо невідомий
   */
  readonly paragraphOffset: number | null
  readonly tableId: string | null
  readonly rowId: string | null
  /** Порядок КОМІРКИ в шляху (cell ordinal); ≠ grid column для merged cells */
  readonly columnIndex: number | null
}

/** Результат локатора: ок або точна причина відсутності адреси. */
export type NodeLocationResult =
  | { readonly ok: true; readonly location: NodeLocation }
  | {
      readonly ok: false
      readonly reason: NodeLocationReason
      readonly paragraphId?: string | null
    }

/** Якор таблиці/рядка — ТОЛЬКО з підтвердженого джерела (engine furniture dataset). */
export type TableAnchor = {
  readonly tableId: string
  readonly rowId: string
}

export type TableLocation = {
  /** null, коли відомий лише rowId, а батьківська таблиця не виведена */
  readonly tableId: string | null
  /** Похідний префікс — рядок, до якого прив'язаний контекст якоря */
  readonly rowId: string | null
}

export type RowLocation = {
  /** Батьківська таблиця рядка, якщо шлях дозволяє однозначно її прочитати */
  readonly tableId: string | null
  readonly rowId: string
}

/** Частковий результат row-запиту: ok або точна причина неповноти. */
export type RowLocationResult =
  | { readonly ok: true; readonly location: RowLocation }
  | { readonly ok: false; readonly reason: NodeLocationReason; readonly rowId: string }

/** Результат table-запиту (нейтральний: без вигадування рядка). */
export type TableLocationResult =
  | { readonly ok: true; readonly location: TableLocation }
  | { readonly ok: false; readonly reason: NodeLocationReason; readonly tableId: string }

/** Плоска бізнес-вистава Custom Node (мінімум для роботи логіки). */
export type DocumentNode = {
  readonly nodeId: string
  /** Канонічний w:tag (незмінений рушій) */
  readonly tag: string
  /** Схема identity (staff.{i}.{f} / довільний ключ ручного поля) */
  readonly key: string | null
  readonly flavor: NodeFlavor
  /** staff/cadet — сегмент поля схеми; generic — null */
  readonly fieldType: string | null
  /** staff/cadet — номер людини/курсанта зі схеми; generic — null */
  readonly instance: number | null
  /** персональний binding (attrs.p), якщо прив'язаний; інакше null */
  readonly entityId: string | null
  /** адреса чіпа; повна відсутність адреси з причиною — не вигадуємо */
  readonly location: NodeLocation | null
  readonly locationReason: NodeLocationReason | null
}

/** Рядок debug-виводу Runtime. */
export type DocumentNodeDebug = {
  readonly nodeId: string
  readonly key: string | null
  readonly flavor: NodeFlavor
  readonly instance: number | null
  readonly fieldType: string | null
  readonly paragraphId: string | null
  readonly tableId: string | null
  readonly rowId: string | null
  readonly columnIndex: number | null
  readonly reason: string | null
}
