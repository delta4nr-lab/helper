"use client"

// Нормалізація клавіатурних шорткатів під не-латинські розкладки.
//
// Рушій обробляє Ctrl/Cmd-шорткати через event.key ("z", "b", "k"…), тож на
// українській розкладці (KeyZ→"я", KeyY→"н", KeyB→"и") вони не спрацьовують.
// У рушія вже є fallback по event.code (функція QT), але лише для alt-гілки.
//
// Підхід: перехоплюємо keydown у capture, і якщо фізична клавіша (event.code)
// дає латинську літеру, а event.key — ні, то зупиняємо оригінал і
// перевідправляємо синтетичний KeyboardEvent із key=<латиниця>. Рушій лишається
// ЄДИНИМ місцем, яке виконує команди (undo/redo, formatting, alignment, indent,
// hyperlink, format painter, notes…). Ми лише виправляємо key/code.
//
// Ctrl+Shift+V навмисно НЕ preventDefault-имо: рушій виставляє
// armForcePlainPaste, а сам clipboard-контент має взяти нативний paste.

import * as React from "react"
import { useDocxEditor } from "@docx-editor.dev/react"

// event.code → латинська літера (US-розкладка).
const CODE_LETTER: Record<string, string> = Object.fromEntries(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => [
    `Key${letter}`,
    letter.toLowerCase(),
  ])
)

// Ctrl(+Shift) — shift допустимий.
const CTRL_ANY = new Set(["a", "m", "y", "z"])
// Ctrl — лише без shift (з shift рушій ці літери не обробляє).
const CTRL_NO_SHIFT = new Set(["k", "b", "i", "u", "l", "e", "r", "j"])
// Ctrl+Alt — format painter (c/v) і виноски (d/f), без shift.
const CTRL_ALT = new Set(["c", "d", "f", "v"])

function resolveShortcut(event: KeyboardEvent, latin: string): { send: boolean; prevent: boolean } {
  if (!event.altKey) {
    if (latin === "v") {
      // Ctrl+Shift+V — plain paste: нативний paste лишаємо джерелом контенту.
      return event.shiftKey ? { send: true, prevent: false } : { send: false, prevent: true }
    }
    if (CTRL_ANY.has(latin)) {
      return { send: true, prevent: true }
    }
    if (CTRL_NO_SHIFT.has(latin) && !event.shiftKey) {
      // macOS Cmd+R — reload: лишаємо нативним (як і рушій).
      if (event.metaKey && latin === "r") return { send: false, prevent: true }
      return { send: true, prevent: true }
    }
    return { send: false, prevent: true }
  }
  if (CTRL_ALT.has(latin) && !event.shiftKey) {
    return { send: true, prevent: true }
  }
  return { send: false, prevent: true }
}

export function KeyboardLayoutShortcuts() {
  const editor = useDocxEditor()
  const replaying = React.useRef(false)

  React.useEffect(() => {
    if (!editor) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (replaying.current || event.defaultPrevented || event.isComposing) return
      if (!(event.ctrlKey || event.metaKey)) return
      const latin = CODE_LETTER[event.code]
      if (!latin) return
      // Латиниця: рушій обробляє сам — не втручаємось (і не дублюємо).
      if (event.key.toLowerCase() === latin) return
      const target = event.target as HTMLElement | null
      // Contenteditable-хост рушія — сам `.docx-pages` (не `.docx-page-content`,
      // який є його нащадком), тож фокус у документі дає target = `.docx-pages`.
      if (!target?.closest(".docx-pages")) return

      const { send, prevent } = resolveShortcut(event, latin)
      if (!send) return

      // Для команд рушія глушимо оригінал (нативні reload/print/find + подвійне
      // виконання через alt-гілку, яка матчить по event.code). Для Ctrl+Shift+V
      // НЕ глушимо — потрібен нативний paste.
      if (prevent) {
        event.preventDefault()
        event.stopPropagation()
      }

      replaying.current = true
      try {
        target.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: latin,
            code: event.code,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            repeat: event.repeat,
            isComposing: event.isComposing,
            bubbles: true,
            cancelable: true,
            composed: true,
            modifierAltGraph: event.getModifierState("AltGraph"),
            modifierCapsLock: event.getModifierState("CapsLock"),
          })
        )
      } finally {
        replaying.current = false
      }
    }
    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  }, [editor])

  return null
}
