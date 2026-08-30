"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// Розміри A4 при 96dpi (як у Word) + поля за замовчуванням: верх/низ 2см, ліве 2см, праве 1см.
// Як у lib/documents/export/parse-tables.ts. A4 210×297мм → 794×1123px.
export const A4_PX = {
  width: 794,
  height: 1123,
  // Поля: верх 2см (76px), низ 2см (76px), ліве 2см (76px), праве 1см (38px)
  marginTop: 76,
  marginBottom: 76,
  marginLeft: 76,
  marginRight: 38,
  usable: 680, // 794 - 76 - 38
  // альбом
  landscapeWidth: 1123,
  landscapeHeight: 794,
  landscapeUsable: 1009, // 1123 - 76 - 38
} as const

// CSS padding: top right bottom left
export const A4_PADDING = `${A4_PX.marginTop}px ${A4_PX.marginRight}px ${A4_PX.marginBottom}px ${A4_PX.marginLeft}px`

export type PaperKind = "А4" | "А4 альбом"

export function isLandscapePaper(paper?: string | null): boolean {
  return paper === "А4 альбом"
}

type Props = {
  paper?: PaperKind | string | null
  children: React.ReactNode
  className?: string
  // якщо true — показати лінійку/тінь як в Word, інакше просто білий лист
  withShadow?: boolean
}

export function A4Page({ paper, children, className, withShadow = true }: Props) {
  const landscape = isLandscapePaper(paper ?? "А4")
  const w = landscape ? A4_PX.landscapeWidth : A4_PX.width
  const h = landscape ? A4_PX.landscapeHeight : A4_PX.height

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
          // масштаб на малих екранах — через CSS контейнер, скрол як фолбек
          "max-w-full"
        )}
        style={{
          width: w,
          minHeight: h,
          padding: A4_PADDING,
          // щоб таблиці не розтягувались за межі полів
          boxSizing: "border-box",
        }}
        data-paper={landscape ? "landscape" : "portrait"}
      >
        <div className="a4-content w-full overflow-visible">{children}</div>
      </div>
    </div>
  )
}

// Вузький варіант для превʼю в DocumentForm — без зовнішнього сірого фону, але з тими ж розмірами
export function A4PageInline({ paper, children, className }: Props) {
  const landscape = isLandscapePaper(paper ?? "А4")
  const w = landscape ? A4_PX.landscapeWidth : A4_PX.width
  const h = landscape ? A4_PX.landscapeHeight : A4_PX.height
  return (
    <div className={cn("a4-page-outer overflow-auto bg-white dark:bg-zinc-900", className)}>
      <div
        className="a4-paper mx-auto bg-white text-zinc-900 shadow-sm ring-1 ring-black/5"
        style={{ width: w, minHeight: h, padding: A4_PADDING, boxSizing: "border-box", maxWidth: "100%" }}
        data-paper={landscape ? "landscape" : "portrait"}
      >
        <div className="a4-content w-full">{children}</div>
      </div>
    </div>
  )
}
