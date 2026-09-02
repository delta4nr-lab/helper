// Єдина модель налаштувань сторінки документа.
// Всі значення (розміри, поля) зберігаються в мм.
// Конвертери для CSS (px) та DOCX (DXA/twips) — єдине джерело істини,
// щоб редактор і експорт завжди збігалися.

export type PageSize = "A4" | "A3" | "A5" | "LETTER" | "LEGAL" | "TABLOID"
export type PageOrientation = "portrait" | "landscape"

export type PageMargins = {
  top: number
  right: number
  bottom: number
  left: number
}

export type PageSettings = {
  size: PageSize
  orientation: PageOrientation
  margins: PageMargins
}

// ── Фізичні розміри ────────────────────────────────────────────────
export const MM_PER_INCH = 25.4
export const PX_PER_INCH = 96
export const TWIPS_PER_INCH = 1440 // 1 pt = 20 twips

// Розміри аркушів у мм (ширина × висота). Збігаються з PAGE_SIZES пакета
// tiptap-pagination-plus (px при 96dpi).
export const PAGE_SIZE_MM: Record<PageSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A5: { width: 148, height: 210 },
  LETTER: { width: 215.9, height: 279.4 },
  LEGAL: { width: 215.9, height: 355.6 },
  TABLOID: { width: 279.4, height: 431.8 },
}

// ── Конвертери ─────────────────────────────────────────────────────
export function mmToPx(mm: number): number {
  return (mm / MM_PER_INCH) * PX_PER_INCH
}

export function mmToDxa(mm: number): number {
  return Math.round((mm / MM_PER_INCH) * TWIPS_PER_INCH)
}

// ── Дефолт (збережено значення, що були в редакторі) ───────────────
// Поля: верх 20мм, низ 20мм, ліве 20мм, праве 10мм.
export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  size: "A4",
  orientation: "portrait",
  margins: { top: 20, right: 10, bottom: 20, left: 20 },
}

// ── Обчислення ─────────────────────────────────────────────────────
export function pageSizeMm(settings: PageSettings): { width: number; height: number } {
  const base = PAGE_SIZE_MM[settings.size] ?? PAGE_SIZE_MM.A4
  return settings.orientation === "landscape"
    ? { width: base.height, height: base.width }
    : { width: base.width, height: base.height }
}

export function pageSizePx(settings: PageSettings): { width: number; height: number } {
  const { width, height } = pageSizeMm(settings)
  return { width: Math.round(mmToPx(width)), height: Math.round(mmToPx(height)) }
}

export function pageSizeDxa(settings: PageSettings): { width: number; height: number } {
  const { width, height } = pageSizeMm(settings)
  return { width: mmToDxa(width), height: mmToDxa(height) }
}

export function marginsPx(settings: PageSettings): PageMargins {
  const m = settings.margins
  return {
    top: Math.round(mmToPx(m.top)),
    right: Math.round(mmToPx(m.right)),
    bottom: Math.round(mmToPx(m.bottom)),
    left: Math.round(mmToPx(m.left)),
  }
}

export function marginsDxa(settings: PageSettings): PageMargins {
  const m = settings.margins
  return {
    top: mmToDxa(m.top),
    right: mmToDxa(m.right),
    bottom: mmToDxa(m.bottom),
    left: mmToDxa(m.left),
  }
}

// Робоча область контенту (без полів)
export function usableMm(settings: PageSettings): { width: number; height: number } {
  const size = pageSizeMm(settings)
  const m = settings.margins
  return {
    width: size.width - m.left - m.right,
    height: size.height - m.top - m.bottom,
  }
}

export function usablePx(settings: PageSettings): { width: number; height: number } {
  const { width, height } = usableMm(settings)
  return { width: Math.round(mmToPx(width)), height: Math.round(mmToPx(height)) }
}

export function usableDxa(settings: PageSettings): { width: number; height: number } {
  const { width, height } = usableMm(settings)
  return { width: mmToDxa(width), height: mmToDxa(height) }
}

// ── Серіалізація (для localStorage/експорту) ────────────────────────
export function serializePageSettings(settings: PageSettings): string {
  return JSON.stringify(settings)
}

export function parsePageSettings(raw: string | null | undefined): PageSettings | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as PageSettings
    if (value?.size && value?.margins) {
      const size = value.size in PAGE_SIZE_MM ? (value.size as PageSize) : "A4"
      return {
        size,
        orientation: value.orientation === "landscape" ? "landscape" : "portrait",
        margins: {
          top: Number(value.margins.top),
          right: Number(value.margins.right),
          bottom: Number(value.margins.bottom),
          left: Number(value.margins.left),
        },
      }
    }
  } catch {
    // некоректні дані — дефолт
  }
  return null
}

// Конвертація старого рядка Template.paper ("А4" | "А4 альбом") у PageSettings
// зі стандартними полями (для сумісності зі збереженими шаблонами).
export function pageSettingsFromPaper(paper: string | null | undefined): PageSettings {
  return {
    ...DEFAULT_PAGE_SETTINGS,
    orientation: paper === "А4 альбом" ? "landscape" : "portrait",
  }
}