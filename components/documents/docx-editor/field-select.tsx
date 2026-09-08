"use client"

// «Очистка поля»: клік по чіпу кастомного поля → виділити весь його вміст,
// щоб перший наступний символ замінив назву (публічним API, без читання DOM).
//   paraId каретки — зі snapshot.selection (DocRange несе paraId без офсетів);
//   текст чіпа — customNodesOf(editor) за тегом;
//   виділення — setSelection з DocAnchor-арма { paraId, search } (search має
//   збігатися РІВНО ОДИН раз у абзаці: дві однакові назви в одному абзаці
//   не виділяться — движок відмовляє, тихо пропускаємо).
// Прапор кліку ставиться на pointerUP (capture, лише ліва кнопка) — до
// дефолтної дії браузера, тому виділення не перетирається mouseup-кареткою.
// Звичайний друк усередині поля прапорів не ставить — поле не перевиділяється.

import * as React from "react"
import { customNodesOf, decodeCustomNodeTag } from "@docx-editor.dev/pro"
import type { DocxEditorInstance } from "@docx-editor.dev/core/editor"
import { useDocxEditor } from "@docx-editor.dev/react"

import { FieldNode } from "@/lib/docx-editor/field-node"

const LOG = "[field-select]"

// Каретка одразу ЗА щойно вставленою нодою — рушійним шляхом, без DOM:
// editor.getReviewItems() (доступний завдяки reviewModule) дає для кожної
// ноди рушійний range — ReviewRange { start, end: { paragraphId, offset } }.
// Кінець ноди від рушія + публічний setSelection у SemanticPosition-армах
// { paragraphId, offset } — і каретка стоїть за чіпом, як при друці.
// Задокументованого прямого «caret after node» немає, тому цей обхідний
// шлях через рушійні позиції (documentaція «Review items — requires the
// review module»).
//
// Review items виводяться асинхронно після вставки, тому читання — цикл
// по кадрах до появи ноди. Пост-перевірка (atCaret після setSelection)
// показує affinity: чи рушій все ще бачить чіп у каретці.
export async function placeCaretBesideField(editor: DocxEditorInstance): Promise<boolean> {
  // Діалог повернув фокус на тулбар: каретка-оверлей малюється лише в
  // сфокусованому редакторі, тому спершу повертаємо фокус движку.
  const focused = editor.surface?.focus()
  console.info(LOG, "focus →", focused)

  // Чіп на мить активний — atCaret() дає його тег для пошуку review item.
  const boundary = editor.surface?.contentControls.atCaret()
  if (!boundary) {
    console.info(LOG, "caret: активного контрола немає")
    return false
  }
  console.info(LOG, "caret: активний контрол →", { id: boundary.id, tag: boundary.tag })

  // Режим заповнення: каретку лишаємо в полі, але вміст чіпа виділяємо —
  // друк одразу заміняє назву (заповнення). Anchor-search — той самий
  // перевірений шлях, що й у FieldSelect.
  if (editor.surface?.contentControls.formFill()) {
    const chipText = customNodesOf(editor).find((candidate) => candidate.tag === boundary.tag)?.text
    const from = editor.snapshot().selection?.from
    const paraId = from && "paraId" in from ? from.paraId : null
    console.info(LOG, "режим заповнення → виділяємо вміст чіпа", { chipText, paraId })
    if (chipText && paraId) {
      editor.exec({
        type: "setSelection",
        range: {
          from: { paraId, search: chipText },
          to: { paraId, search: chipText },
        },
      })
    }
    return true
  }

  let end: { paragraphId: string; offset: number } | null = null
  for (let attempt = 0; attempt < 10 && !end; attempt++) {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const entry = editor
      .getReviewItems()
      .find((candidate) => candidate.kind === "custom" && candidate.item.tag === boundary.tag)
    if (!entry || entry.kind !== "custom") continue
    const itemRange = entry.item.range
    if (!itemRange) {
      console.info(LOG, "caret: review item знайдено, але range = null", {
        id: entry.item.id,
        name: entry.item.name,
      })
      return false
    }
    end = itemRange.end
    console.info(LOG, "caret: review item →", {
      id: entry.item.id,
      name: entry.item.name,
      start: itemRange.start,
      end: itemRange.end,
    })
    break
  }
  if (!end) {
    console.info(LOG, "caret: review item не з'явився за 10 кадрів (review module зареєстровано?)")
    return false
  }

  const result = editor.exec({
    type: "setSelection",
    range: {
      anchor: { paragraphId: end.paragraphId, offset: end.offset },
      head: { paragraphId: end.paragraphId, offset: end.offset },
    },
  })
  if (!result.ok) {
    console.info(LOG, "caret: setSelection відхилено →", {
      code: result.code,
      reason: result.reason,
      ...end,
    })
    return false
  }

  // Post-check: чи рушій все ще бачить чіп у каретці (affinity позиції).
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  const after = editor.surface?.contentControls.atCaret()
  console.info(LOG, "caret: post-check →", {
    ...end,
    chipStillAtCaret: after?.id === boundary.id,
    selectionCollapsed: editor.snapshot().selectionCollapsed,
  })
  return true
}

export function FieldSelect() {
  const editor = useDocxEditor()
  const previousTag = React.useRef<string | null>(null)
  const wasClick = React.useRef(false)

  React.useEffect(() => {
    if (!editor) return
    const onPointerUp = (event: PointerEvent) => {
      if (event.button !== 0) return
      const target = event.target as HTMLElement | null
      if (!target?.closest("[data-line-id]")) return
      wasClick.current = true
    }
    document.addEventListener("pointerup", onPointerUp, true)
    return () => {
      document.removeEventListener("pointerup", onPointerUp, true)
    }
  }, [editor])

  React.useEffect(() => {
    if (!editor) return
    return editor.on("selectionChange", (snapshot) => {
      // Прапор кліку діє лише до найближчого selectionChange — читаємо і
      // скидаємо до будь-яких ранніх виходів, щоб він не «протік» у друк.
      const click = wasClick.current
      wasClick.current = false
      if (!editor.surface || !snapshot.editable) return
      if (!snapshot.selectionCollapsed) return
      const control = editor.query({ type: "contentControlAt" })
      const tag = control?.tag ?? null
      const entered = tag !== null && tag !== previousTag.current
      previousTag.current = tag
      // Тег несе закодовані attrs (key вшито в w:tag), тому порівнюємо
      // розкодований prefix/name, а не буквальний "acme:field".
      const decoded = tag !== null ? decodeCustomNodeTag(tag) : null
      const isField =
        decoded !== null &&
        decoded.prefix === FieldNode.tagPrefix &&
        decoded.name === FieldNode.name
      if (!isField) return
      if (!entered && !click) return

      // paraId каретки: DocRange у snapshot несе paraId без офсетів.
      const from = snapshot.selection?.from
      const paraId = from && "paraId" in from ? from.paraId : null
      if (!paraId) return
      const text = customNodesOf(editor).find((node) => node.tag === tag)?.text
      if (!text) return
      const result = editor.exec({
        type: "setSelection",
        range: {
          from: { paraId, search: text },
          to: { paraId, search: text },
        },
      })
      if (result.ok && editor.query({ type: "selectedText" }) === text) {
        console.info(LOG, "вміст поля виділено", JSON.stringify(text))
      } else if (!result.ok) {
        console.info(LOG, "виділення відхилено →", { code: result.code, reason: result.reason, text })
      }
    })
  }, [editor])

  return null
}
