"use client"

// useDocumentRuntime — мінімальна React-інтеграція Runtime v1.
//
// БЕЗ глобального state: Runtime створюється для editor-референсу
// (memo на референсі). Editor залишається джерелом істини; hook лише
// дає доступ до фасада (index/locator/nodes/tables/transaction) і
// lazy-rebuild через revision-guard індексу.

import * as React from "react"
import { useDocxEditor } from "@docx-editor.dev/react"

import { DocumentRuntime } from "@/components/documents/docx-editor/runtime/document-runtime"

export function useDocumentRuntime(): DocumentRuntime | null {
  const editor = useDocxEditor()
  return React.useMemo(
    () =>
      editor
        ? new DocumentRuntime(editor)
        : null,
    // Editor-референс з контексту стабільний протягом одного документа
    [editor]
  )
}
