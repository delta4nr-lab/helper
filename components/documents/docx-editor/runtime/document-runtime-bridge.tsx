"use client"

// Dev-bridge Runtime v1 у Workspace: створює runtime для editor-референсу
// і виставляє dev-only діагностику в консоль.
//
// Мінімальне підключення ЗА ВИМОГОЮ: існуючі компоненти/потоки не
// змінюються; editor — джерело істини; runtime лише індексує документ.
// У production глобальний хелпер не виставляється і_refresh не крутиться.

import * as React from "react"
import { useDocumentRuntime } from "@/components/documents/docx-editor/runtime/use-document-runtime"

export function DocumentRuntimeBridge() {
  const runtime = useDocumentRuntime()

  React.useEffect(() => {
    if (!runtime) return
    runtime.refresh()
    // Dev-only діагностика: console.__docxRuntimeDebug() → debug-таблиця
    if (process.env.NODE_ENV !== "production") {
      const scope = window as { __docxRuntimeDebug?: (anchor?: { tableId?: string; rowId?: string }) => void }
      scope.__docxRuntimeDebug = (anchor) => runtime.debug(anchor)
      return () => {
        delete scope.__docxRuntimeDebug
      }
    }
  }, [runtime])

  return null
}
