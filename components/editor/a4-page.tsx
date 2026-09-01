"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

import {
  DEFAULT_PAGE_SETTINGS,
  marginsPx,
  pageSizePx,
  pageSettingsFromPaper,
  usablePx,
  type PageSettings,
} from "@/lib/documents/page"

// Розміри A4 та поля — розраховуються з єдиної моделі page settings (mm → px при 96dpi),
// щоб редактор і експорт завжди збігалися.
const portraitPx = pageSizePx(DEFAULT_PAGE_SETTINGS)
const landscapeSettings: PageSettings = { ...DEFAULT_PAGE_SETTINGS, orientation: "landscape" }
const landscapePx = pageSizePx(landscapeSettings)
const portraitMargins = marginsPx(DEFAULT_PAGE_SETTINGS)
const portraitUsable = usablePx(DEFAULT_PAGE_SETTINGS)
const landscapeUsable = usablePx(landscapeSettings)

export const A4_PX = {
  width: portraitPx.width,
  height: portraitPx.height,
  marginTop: portraitMargins.top,
  marginBottom: portraitMargins.bottom,
  marginLeft: portraitMargins.left,
  marginRight: portraitMargins.right,
  usable: portraitUsable.width,
  landscapeWidth: landscapePx.width,
  landscapeHeight: landscapePx.height,
  landscapeUsable: landscapeUsable.width,
}

// CSS padding: top right bottom left
export const A4_PADDING = `${A4_PX.marginTop}px ${A4_PX.marginRight}px ${A4_PX.marginBottom}px ${A4_PX.marginLeft}px`

export type PaperKind = "А4" | "А4 альбом"

export function isLandscapePaper(paper?: string | null): boolean {
  return paper === "А4 альбом"
}

// CSS-розміри та поля аркуша для конкретних налаштувань сторінки
export function pageCss(settings: PageSettings): { width: number; height: number; padding: string } {
  const size = pageSizePx(settings)
  const margins = marginsPx(settings)
  return {
    width: size.width,
    height: size.height,
    padding: `${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px`,
  }
}

type Props = {
  paper?: PaperKind | string | null
  children: React.ReactNode
  className?: string
  // якщо true — показати лінійку/тінь як в Word, інакше просто білий лист
  withShadow?: boolean
}

export function A4Page({ paper, children, className, withShadow = true }: Props) {
  const css = pageCss(pageSettingsFromPaper(paper))

  return (
    <div
      className={cn(
        "a4-page-outer flex justify-center overflow-auto bg-zinc-100 p-3 dark:bg-zinc-900 sm:p-4",
        className
      )}
    >
      <div
        className={cn(
          "a4-paper shrink-0 bg-white text-zinc-900",
          withShadow && "shadow-lg ring-1 ring-black/10",
          "max-w-full"
        )}
        style={{
          width: css.width,
          minHeight: css.height,
          padding: css.padding,
          boxSizing: "border-box",
        }}
        data-paper={isLandscapePaper(paper) ? "landscape" : "portrait"}
      >
        <div className="a4-content w-full overflow-visible">{children}</div>
      </div>
    </div>
  )
}

// Вузький варіант для превʼю — без зовнішнього сірого фону, але з тими ж розмірами
export function A4PageInline({ paper, children, className }: Props) {
  const css = pageCss(pageSettingsFromPaper(paper))
  return (
    <div className={cn("a4-page-outer overflow-auto bg-white dark:bg-zinc-900", className)}>
      <div
        className="a4-paper mx-auto bg-white text-zinc-900 shadow-sm ring-1 ring-black/5"
        style={{ width: css.width, minHeight: css.height, padding: css.padding, boxSizing: "border-box", maxWidth: "100%" }}
        data-paper={isLandscapePaper(paper) ? "landscape" : "portrait"}
      >
        <div className="a4-content w-full">{children}</div>
      </div>
    </div>
  )
}