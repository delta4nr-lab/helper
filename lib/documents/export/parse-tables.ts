import "server-only"

// Модель таблиці для docx / exceljs / pdfmake.
// Джерело — Tiptap HTML (StyledTable) з data-borderless та colgroup/col стилями.
// Конвертація px → DXA: 1in = 1440 DXA, 96dpi → 15 DXA на px.

export const DXA_PER_PX = 15
export const A4_WIDTH_DXA = 11906 // 210mm
export const A4_HEIGHT_DXA = 16838 // 297mm
// Поля за замовчуванням: верх 2см, низ 2см, ліве 2см, праве 1см (1см = 567 twips)
export const MARGIN_TOP_DXA = 1134
export const MARGIN_BOTTOM_DXA = 1134
export const MARGIN_LEFT_DXA = 1134
export const MARGIN_RIGHT_DXA = 567
export const USABLE_WIDTH_DXA = A4_WIDTH_DXA - MARGIN_LEFT_DXA - MARGIN_RIGHT_DXA // 10205
export const USABLE_WIDTH_LANDSCAPE_DXA = A4_HEIGHT_DXA - MARGIN_LEFT_DXA - MARGIN_RIGHT_DXA // 15137
export const USABLE_HEIGHT_DXA = A4_HEIGHT_DXA - MARGIN_TOP_DXA - MARGIN_BOTTOM_DXA // 14570

export function getUsableWidthDxa(paper?: string | null): number {
  return paper === "А4 альбом" ? USABLE_WIDTH_LANDSCAPE_DXA : USABLE_WIDTH_DXA
}
export function isLandscapePaper(paper?: string | null): boolean {
  return paper === "А4 альбом"
}

export type TableCellModel = {
  colspan: number
  rowspan: number
  widthDxa: number | null
  html: string
  textAlign: string | null
}

export type TableRowModel = TableCellModel[]

export type TableWidthMode = "fixed" | "percent" | "auto"

export type TableModel = {
  isBorderless: boolean
  // fixed — автор задав точну ширину (width: Xpx) → зберігається 1:1
  // percent — автор задав відсоток (width: X%)
  // auto — без явної ширини, займає всю ширину аркуша
  width: { size: number; mode: TableWidthMode }
  // Ширина колонок в DXA (вже розподілена під ширину таблиці)
  colWidthsDxa: number[]
  // Чи колонка має явно задану ширину (width у colgroup/td) — фіксована
  colWidthsFixed: boolean[]
  rows: TableRowModel[]
}

function parseStyle(style?: string | null): Record<string, string> {
  if (!style) return {}
  const map: Record<string, string> = {}
  for (const part of style.split(";")) {
    const [rawKey, ...rawVal] = part.split(":")
    if (!rawKey || rawVal.length === 0) continue
    const key = rawKey.trim().toLowerCase()
    const val = rawVal.join(":").trim()
    if (key && val) map[key] = val
  }
  return map
}

function widthToDxa(raw?: string | null): number | null {
  if (!raw) return null
  const v = raw.trim().toLowerCase()
  // px
  const px = v.match(/^([\d.]+)px$/)
  if (px) return Math.round(Number(px[1]) * DXA_PER_PX)
  // pt (1pt = 20 DXA)
  const pt = v.match(/^([\d.]+)pt$/)
  if (pt) return Math.round(Number(pt[1]) * 20)
  return null
}

// Режим ширини таблиці за style-атрибутом.
// min-width (генерується Tiptap для auto-таблиць) не є бажаною шириною автора → трактуємо як auto.
function extractTableWidth($table: { attr: (n: string) => string | undefined }): { size: number; mode: TableWidthMode } | null {
  const style = $table.attr("style") ?? ""
  const map = parseStyle(style)
  const rawWidth = (map["width"] ?? "").trim()
  if (rawWidth) {
    if (rawWidth.endsWith("%")) {
      const pct = Number(rawWidth.replace("%", "").trim())
      if (Number.isFinite(pct) && pct > 0 && pct <= 100) return { size: pct, mode: "percent" }
    } else {
      const dxa = widthToDxa(rawWidth)
      if (dxa !== null && dxa > 0) return { size: dxa, mode: "fixed" }
    }
  }
  return null
}

// Пропорційне масштабування колонок до targetWidth (для percent / оборонки)
function scaleToTarget(widths: number[], targetWidth: number): number[] {
  const sum = widths.reduce((a, b) => a + b, 0)
  if (sum <= 0) {
    const per = Math.floor(targetWidth / widths.length)
    return widths.map((_, i) => (i === widths.length - 1 ? targetWidth - per * (widths.length - 1) : per))
  }
  const ratio = targetWidth / sum
  const out = widths.map((w) => Math.max(Math.round(w * ratio), 0))
  const newSum = out.reduce((a, b) => a + b, 0)
  const diff = targetWidth - newSum
  if (diff !== 0 && out.length > 0) out[out.length - 1] += diff
  return out
}

// Розподіл ширини колонок під targetWidth зі збереженням фіксованих колонок.
function distributeColumnWidths(
  colWidthsDxa: number[],
  colWidthsFixed: boolean[],
  targetWidth: number,
  mode: TableWidthMode
): number[] {
  const out = [...colWidthsDxa]
  const colCount = out.length
  if (colCount === 0) return []

  const fixedSum = out.reduce((sum, w, i) => sum + (colWidthsFixed[i] && w > 0 ? w : 0), 0)
  const autoIndices = out.map((w, i) => i).filter((i) => !colWidthsFixed[i] || out[i] <= 0)

  if (mode === "auto") {
    // Фіксовані лишаються, auto-колонки ділять залишок до повної ширини аркуша
    if (autoIndices.length === 0) {
      // Всі фіксовані (рукописний HTML) — масштабуємо до target
      return scaleToTarget(out, targetWidth)
    }
    const remaining = Math.max(targetWidth - fixedSum, autoIndices.length)
    const per = Math.floor(remaining / autoIndices.length)
    autoIndices.forEach((idx, k) => {
      out[idx] = k === autoIndices.length - 1 ? remaining - per * (autoIndices.length - 1) : per
    })
    return out
  }

  if (mode === "percent") {
    // Пропорційний розтяг усіх колонок до % від аркуша
    const scaled = scaleToTarget(out, targetWidth)
    const zeroIndices = scaled.map((w, i) => i).filter((i) => scaled[i] <= 0)
    if (zeroIndices.length > 0) {
      const sumPos = scaled.filter((w) => w > 0).reduce((a, b) => a + b, 0)
      const remaining = Math.max(targetWidth - sumPos, zeroIndices.length)
      const per = Math.floor(remaining / zeroIndices.length)
      zeroIndices.forEach((idx, k) => {
        scaled[idx] = k === zeroIndices.length - 1 ? remaining - per * (zeroIndices.length - 1) : per
      })
    }
    return scaled
  }

  // fixed — зберігаємо 1:1 (як задумав автор), лише корекція суми до width
  if (fixedSum === 0 || Math.abs(fixedSum - targetWidth) > 5) {
    return scaleToTarget(out, targetWidth)
  }
  return out
}

/**
 * Витягує модель таблиці з cheerio-елемента <table>.
 * Використовується в docx / excel / pdf експортерах.
 */
export function extractTableModel($table: unknown, $: unknown, paper?: string | null): TableModel {
  // $table — cheerio Cheerio, $ — cheerio root (для пошуку всередині)
  const $t = $table as ReturnType<import("cheerio").CheerioAPI>
  const cheerioRoot = $ as import("cheerio").CheerioAPI

  const isBorderless = $t.attr("data-borderless") === "true"

  const usableForPaper = getUsableWidthDxa(paper)
  // Ширина таблиці
  const fromStyle = extractTableWidth($t)
  // Без явної ширини — auto: займає всю ширину аркуша (як у preview width:100%)
  const width: { size: number; mode: TableWidthMode } = fromStyle ?? { size: usableForPaper, mode: "auto" }

  // Ширини колонок — пріоритет: <colgroup><col style="width"> → перший ряд <td style="width">
  let colWidthsDxa: number[] = []
  let colWidthsFixed: boolean[] = []

  const $cols = $t.find("colgroup col")
  if ($cols.length > 0) {
    $cols.each((_, el) => {
      const m = parseStyle(cheerioRoot(el).attr("style") ?? "")
      const hasWidth = !!m["width"]
      const w = widthToDxa(m["width"] ?? m["min-width"] ?? "")
      colWidthsDxa.push(w ?? 0)
      colWidthsFixed.push(hasWidth && w !== null)
    })
  }

  // Фолбек — перший ряд td widths (лише якщо colgroup не дав жодної ширини)
  const hasAnyColWidth = colWidthsDxa.some((w) => w > 0)
  if (!hasAnyColWidth) {
    colWidthsDxa = []
    colWidthsFixed = []
    const $firstRow = $t.find("tr").first()
    const $cells = $firstRow.find("td, th")
    if ($cells.length > 0) {
      $cells.each((_, el) => {
        const m = parseStyle(cheerioRoot(el).attr("style") ?? "")
        const w = widthToDxa(m["width"] ?? "")
        const colSpan = Math.max(1, Number(cheerioRoot(el).attr("colspan") ?? "1"))
        for (let i = 0; i < colSpan; i++) {
          colWidthsDxa.push(w ?? 0)
          colWidthsFixed.push(w !== null)
        }
      })
    }
  }

  // Кількість колонок
  const colCount = (() => {
    if (colWidthsDxa.length > 0) return colWidthsDxa.length
    const $firstRow = $t.find("tr").first()
    let c = 0
    $firstRow.find("td, th").each((_, el) => {
      c += Math.max(1, Number(cheerioRoot(el).attr("colspan") ?? "1"))
    })
    return c || 1
  })()

  // Доводимо кількість колонок до colCount
  if (colWidthsDxa.length < colCount) {
    const missing = colCount - colWidthsDxa.length
    colWidthsDxa.push(...Array.from({ length: missing }, () => 0))
    colWidthsFixed.push(...Array.from({ length: missing }, () => false))
  } else if (colWidthsDxa.length > colCount) {
    colWidthsDxa = colWidthsDxa.slice(0, colCount)
    colWidthsFixed = colWidthsFixed.slice(0, colCount)
  }

  // Цільова ширина таблиці в DXA
  const targetWidth = width.mode === "percent" ? Math.round((usableForPaper * width.size) / 100) : width.size

  // Розподіл ширини колонок відповідно до режиму
  colWidthsDxa = distributeColumnWidths(colWidthsDxa, colWidthsFixed, targetWidth, width.mode)

  // Рядки
  const rows: TableRowModel[] = []
  $t.find("tr").each((_, trEl) => {
    const $tr = cheerioRoot(trEl)
    const cells: TableCellModel[] = []
    $tr.find("td, th").each((_, tdEl) => {
      const $td = cheerioRoot(tdEl)
      const colspan = Math.max(1, Number($td.attr("colspan") ?? "1"))
      const rowspan = Math.max(1, Number($td.attr("rowspan") ?? "1"))
      const style = $td.attr("style") ?? ""
      const m = parseStyle(style)
      const w = widthToDxa(m["width"] ?? "")
      const align = (m["text-align"] ?? $td.attr("align") ?? null) as string | null
      const html = $td.html() ?? ""
      cells.push({ colspan, rowspan, widthDxa: w, html, textAlign: align })
    })
    if (cells.length > 0) rows.push(cells)
  })

  return { isBorderless, width, colWidthsDxa, colWidthsFixed, rows }
}

// Для excel/pdf — утиліти конвертації
export function dxaToPx(dxa: number): number {
  return Math.round(dxa / DXA_PER_PX)
}
export function dxaToPt(dxa: number): number {
  return Math.round(dxa / 20)
}