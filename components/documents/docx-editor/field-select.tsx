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
import { useDocxEditor } from "@docx-editor.dev/react"

import { FieldNode } from "@/lib/docx-editor/field-node"

const LOG = "[field-select]"

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
      if (!entered && !click) {
        console.info(LOG, "всередині поля без кліку/входу — пропускаємо", { tag, decoded })
        return
      }
      console.info(LOG, "активація поля →", { tag, decoded, click, entered })

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
