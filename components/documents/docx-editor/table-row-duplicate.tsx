"use client"

// Контролер «+» у таблиці як «ДОДАТИ ЩЕ ЛЮДИНУ/КУРСАНТА» (user flow):
// двигун сам малює кнопку рядка (button.docx-table-insert-row, шар
// .docx-table-furniture з dataset.tableId/dataset.rowId) — ми лише
// перехоплюємо клік на ній (capture на document, раніше за engine-клік
// handler на кнопці):
//   1. SNAPSHOT чіпів документів (без вставки) + caret-probe;
//   2. рядок-классификация: полоса чіпів одного rowIndex, чия вертикальна
//      полоса містить centerY engine-кнопки — ЦЕ source row;
//   3. рядок БЕЗ чіпів (band не найден) → ЖОДНОГО блокування: клік
//      проходить до двигуна (звичайний insertRow);
//   4. рядок з чіпами → перехоплення (preventDefault/stopPropagation) +
//      duplicateTableRow() — targeted insertRow тільки з tableId/rowId/
//      sourceRevision, без fallback, відмова → warn/toast без змін.
// Логіка одна для всіх режимів; компонент монтується в документ-режимі.
// Мутацій/DOM-клонування немає: подія click + публічні API.

import * as React from "react"
import { useDocxEditor } from "@docx-editor.dev/react"

import { duplicateTableRow } from "@/lib/docx-editor/table-row-duplicate"
import { customNodesOf } from "@docx-editor.dev/pro"
import { resolvePersonField } from "@/components/documents/docx-editor/personnel-picker"
import { suspendFieldSelect } from "@/components/documents/docx-editor/field-select"

export function TableRowDuplicate() {
  const editor = useDocxEditor()

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
      if (!tableId || !rowId) {
        console.warn("[table-row-duplicate]", "кнопка без dataset → звільняємо клік двигуну")
        return
      }

      // ── Синхронна класифікація ДО insertRow ──
      // Знімок чіпів (paraId через review/DOM-fallback, caret-probe рядків)
      // + вертикальні полоси чіпів за rowIndex; engine-кнопка вертикально
      // лежить посередині свого рядка (rowMidY) → матч полоси.
      suspendFieldSelect(true)
      let sourceRowIndex: number | null = null
      try {
        const originalParaId = (
          editor.query({ type: "selection" })?.from as { paraId?: string } | undefined
        )?.paraId ?? null
        const customNodes = customNodesOf(editor)
        // Мінімальний caret-probe: тільки АБЗАЦИ чіпів. Геометрія рядка —
        // з РЕКТА ПАРАГРАФА чіпа ([data-paragraph-id] пейнтований завжди),
        // а не з boundary чіпа (рухомий хром малюється не завжди).
        type ChipRow = { rowIndex: number; top: number; bottom: number }
        const chipRows: ChipRow[] = []
        for (const node of customNodes) {
          const info = resolvePersonField(editor, node)
          if (!info) continue
          let paraId: string | null = null
          for (const entry of editor.getReviewItems()) {
            if (entry.kind !== "custom" || entry.item.id !== node.nodeId) continue
            paraId = entry.item.range?.start?.paragraphId ?? null
            break
          }
          if (!paraId) {
            const chrome = document.querySelector<HTMLElement>(
              `.docx-content-control-chrome[data-docx-content-control="${CSS.escape(node.nodeId ?? "")}"]`
            )
            paraId = chrome
              ?.closest<HTMLElement>("[data-paragraph-id]")
              ?.getAttribute("data-paragraph-id") ?? null
          }
          if (!paraId) {
            continue
          }
          if (!editor.exec({ type: "setSelection", anchor: { paraId } }).ok) {
            continue
          }
          const context = editor.query({ type: "tableContext" })
          if (!context) {
            continue
          }
          // Рект абзацу чіпа (пейнтований елемент рядка під курсором)
          const paragraphEl = document.querySelector<HTMLElement>(
            `[data-paragraph-id="${CSS.escape(paraId)}"]`
          )
          const rect = paragraphEl?.getBoundingClientRect()
          chipRows.push({
            rowIndex: context.rowIndex,
            top: rect?.top ?? 0,
            bottom: rect?.bottom ?? 0,
          })
        }
        // Повертаємо каретку користувача (probe рухав її)
        if (originalParaId) {
          editor.exec({ type: "setSelection", anchor: { paraId: originalParaId } })
        }

        // Полоса рядка з чіпами, що містить centerY кнопки (rowMidY):
        // band rowIndex = [min top .. max bottom] boundary-ректів чіпів
        const bands = new Map<number, { top: number; bottom: number }>()
        for (const row of chipRows) {
          if (row.top === 0 && row.bottom === 0) continue // boundary не пейнтований
          const band = bands.get(row.rowIndex) ?? { top: Infinity, bottom: -Infinity }
          band.top = Math.min(band.top, row.top)
          band.bottom = Math.max(band.bottom, row.bottom)
          bands.set(row.rowIndex, band)
        }
        const buttonRect = button.getBoundingClientRect()
        const buttonCenterY = buttonRect.top + buttonRect.height / 2
        let sourceRowIndexCandidate: number | null = null
        let bestDistance = Infinity
        for (const [rowIndex, band] of bands) {
          if (!Number.isFinite(band.top) || !Number.isFinite(band.bottom)) continue
          if (buttonCenterY >= band.top && buttonCenterY <= band.bottom) {
            sourceRowIndexCandidate = rowIndex
            bestDistance = 0
            break
          }
          // Вузькі рядки: кнопка (16px) вертикально ширша за полосу чіпів
          const distance = Math.min(
            Math.abs(buttonCenterY - band.top),
            Math.abs(buttonCenterY - band.bottom)
          )
          if (distance < bestDistance) {
            sourceRowIndexCandidate = rowIndex
            bestDistance = distance
          }
        }
        // Допуск: кнопка висотою ~16px, полоса чіпів трохи вужча за рядок
        if (sourceRowIndexCandidate === null || bestDistance > 60) {
          return
        }
        sourceRowIndex = sourceRowIndexCandidate

        // Перехоплюємо й дублюємо рядок (targeted insertRow + нові чіпи)
        event.preventDefault()
        event.stopPropagation()
        const outcome = duplicateTableRow(editor, tableId, rowId, sourceRowIndex)
        if (!outcome.ok) {
          // Вставка не реалізована (targeted can() refused / no caret) —
          // документ НЕ змінюється (жодного fallback)
          return
        }
      } catch (error) {
        console.warn("[table-row-duplicate]", "помилка класифікації/дублювання →", error)
        event.preventDefault()
        event.stopPropagation()
      } finally {
        suspendFieldSelect(false)
      }
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
