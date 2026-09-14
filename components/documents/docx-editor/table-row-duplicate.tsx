"use client"

// Контролери рядка таблиці:
//
//   1. TableRowDuplicate (user flow) — перехоплює клік на engine-кнопці «+»
//      (button.docx-table-insert-row, шар .docx-table-furniture), читає
//      dataset.tableId/rowId і викликає model duplicateTableRow(). Якщо рядок
//      не позначений RepeatRowMarker — intercept:false, клік іде двигуну.
//
//   2. RepeatRowAdmin (template/admin flow) — ОКРЕМА mini-кнопка ПОЗА
//      furniture-шаром (рушій чистить будь-які власні елементи всередині
//      .docx-table-furniture), позиціонована за getBoundingClientRect()
//      реальної «+»-кнопки. Позначає рядок повторюваним через createRepeatRow.
//
// Уся model/engine логіка — в lib/docx-editor/table-row-duplicate.ts.
// DOM використовується ВИКЛЮЧНО для UI-позиціонування overlay-кнопки.

import * as React from "react"
import { useDocxEditor } from "@docx-editor.dev/react"
import { Repeat2 } from "lucide-react"
import { toast } from "sonner"

import { createRepeatRow, duplicateTableRow } from "@/lib/docx-editor/table-row-duplicate"
import type { RepeatSourceContext } from "@/lib/docx-editor/repeat-data"
import { cn } from "@/lib/utils"

export function TableRowDuplicate(props: { sourceContext: RepeatSourceContext }) {
  const editor = useDocxEditor()
  const { sourceContext } = props
  // Стабільний ref, щоб не перепідписувати click-лісенер на кожен рендер.
  const ctxRef = React.useRef(sourceContext)
  React.useEffect(() => {
    ctxRef.current = sourceContext
  }, [sourceContext])

  const onCaptureClick = React.useCallback(
    (event: MouseEvent) => {
      if (!editor) return
      const target = event.target as HTMLElement | null
      const button = target?.closest<HTMLButtonElement>("button.docx-table-insert-row")
      if (!button) return
      // Лише кнопки в шарі furniture нашого редактора
      if (!button.closest(".docx-table-furniture")) return
      const tableId = button.dataset.tableId ?? ""
      const rowId = button.dataset.rowId ?? ""
      if (!tableId || !rowId) return

      const outcome = duplicateTableRow(editor, tableId, rowId, ctxRef.current)
      if (!outcome.intercept) return // рядок без RepeatRowMarker — двигун обробляє сам

      // Ми взяли клік на себе (навіть якщо safe-abort).
      event.preventDefault()
      event.stopPropagation()
    },
    [editor]
  )

  React.useEffect(() => {
    if (!editor) return
    // Capture: раніше за engine поверхневий click handler на button
    document.addEventListener("click", onCaptureClick, true)
    return () => document.removeEventListener("click", onCaptureClick, true)
  }, [editor, onCaptureClick])

  return null
}

// ── Admin: mini-кнопка «зробити рядок повторюваним» ─────────────────────────

type HoverTarget = { tableId: string; rowId: string; left: number; top: number }

/**
 * Показується ТІЛЬКИ в template/admin-режимі. Стежить за курсором над
 * engine-кнопкою «+» рядка (pointerenter фіксує furniture-кнопку), тримає
 * mini-кнопку біля неї і по кліку позначає рядок повторюваним.
 */
export function RepeatRowAdmin() {
  const editor = useDocxEditor()
  const [hover, setHover] = React.useState<HoverTarget | null>(null)
  const hideTimer = React.useRef<number | null>(null)

  const clearHide = React.useCallback(() => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }, [])

  const scheduleHide = React.useCallback(() => {
    clearHide()
    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = null
      setHover(null)
    }, 350)
  }, [clearHide])

  // Рушій малює furniture-кнопки у власному шарі (pointer-events:none на
  // шарі, auto на самих кнопках). Слухаємо pointerover на document і
  // фіксуємо саме button.docx-table-insert-row.
  React.useEffect(() => {
    if (!editor) return
    const onPointerOver = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      // Курсор над нашою mini-кнопкою — не ховаємо (проміжок між «+» і нею).
      if (target?.closest("[data-repeat-admin]")) {
        clearHide()
        return
      }
      const button = target?.closest<HTMLButtonElement>("button.docx-table-insert-row")
      if (!button) {
        scheduleHide()
        return
      }
      const tableId = button.dataset.tableId ?? ""
      const rowId = button.dataset.rowId ?? ""
      if (!tableId || !rowId) {
        scheduleHide()
        return
      }
      const rect = button.getBoundingClientRect()
      clearHide()
      // Під кнопкою «+»: по центру її горизонталі, нижче нижнього краю.
      setHover({
        tableId,
        rowId,
        left: rect.left + rect.width / 2,
        top: rect.bottom + 4,
      })
    }
    document.addEventListener("pointerover", onPointerOver, true)
    return () => document.removeEventListener("pointerover", onPointerOver, true)
  }, [editor, clearHide, scheduleHide])

  React.useEffect(() => () => clearHide(), [clearHide])

  if (!hover) return null

  const handleMark = () => {
    if (!editor) return
    const outcome = createRepeatRow(editor, hover.tableId, hover.rowId)
    if (outcome.ok) {
      toast.success("Рядок позначено повторюваним.")
      setHover(null)
      return
    }
    if (outcome.reason === "already-repeatable") {
      toast.info("Цей рядок уже повторюваний.")
      return
    }
    if (outcome.reason === "no-custom-nodes") {
      toast.warning("Немає персональних полів у рядку — немає що повторювати.")
      return
    }
    toast.error("Не вдалося позначити рядок повторюваним.")
  }

  return (
    <div
      data-repeat-admin
      className="fixed z-50 -translate-x-1/2"
      style={{ left: hover.left, top: hover.top }}
      onPointerEnter={clearHide}
      onPointerLeave={scheduleHide}
    >
      <button
        type="button"
        aria-label="Зробити рядок повторюваним"
        title="Зробити рядок повторюваним"
        onClick={handleMark}
        className={cn(
          "inline-flex size-5 items-center justify-center rounded border border-border",
          "bg-background text-muted-foreground shadow-sm transition-colors",
          "hover:bg-accent hover:text-foreground active:scale-95"
        )}
      >
        <Repeat2 className="size-3.5" />
      </button>
    </div>
  )
}
