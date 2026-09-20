"use client"

import * as React from "react"
import { saveForExport } from "@docx-editor.dev/pro"
import { useDocxEditor } from "@docx-editor.dev/react"
import { toast } from "sonner"

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

// Один експорт триває водночас — фіксований id, щоб loading-тост замінювався
// success/error без накопичення повідомлень.
const EXPORT_TOAST_ID = "docx-export"

type DocumentExportContextValue = {
  exportDocument: () => Promise<void>
  pending: boolean
}

const DocumentExportContext =
  React.createContext<DocumentExportContextValue | null>(null)

export function useDocumentExport(): DocumentExportContextValue {
  const value = React.useContext(DocumentExportContext)
  if (!value) {
    throw new Error(
      "useDocumentExport must be used within DocumentExportProvider"
    )
  }
  return value
}

// Єдина логіка збереження/експорту: кнопка в тулбарі, рядок меню «Файл → Зберегти».
// template-режим: editor.save() + saveHandler (збереження шаблону).
// document-режим: saveForExport() → POST /api/exports → запис у профіль + завантаження.
export function DocumentExportProvider({
  templateId,
  title,
  saveHandler,
  children,
}: {
  templateId: string
  title: string
  saveHandler?: (
    formData: FormData
  ) => Promise<{ ok: boolean; message: string }>
  children: React.ReactNode
}) {
  const editor = useDocxEditor()
  const [pending, setPending] = React.useState(false)

  const exportDocument = React.useCallback(async () => {
    if (!editor || pending) return
    setPending(true)
    toast.loading(
      saveHandler ? "Збереження шаблону..." : "Формування DOCX...",
      { id: EXPORT_TOAST_ID }
    )
    try {
      if (saveHandler) {
        // Копія, яку зберігаємо: editor.save() лишає чіпи полів у шаблоні.
        const buffer = await editor.save()
        const form = new FormData()
        form.set(
          "file",
          new Blob([buffer], { type: DOCX_MIME }),
          "document.docx"
        )
        form.set("title", title)
        const result = await saveHandler(form)
        toast[result.ok ? "success" : "error"](result.message, {
          id: EXPORT_TOAST_ID,
        })
        return
      }

      // Копія, що лишає систему: saveForExport застосовує preserveOnExport
      // визначень (задокументований шлях для зовнішніх копій).
      const outgoing = await saveForExport(editor)
      if (!outgoing.ok) {
        toast.error("Не вдалося сформувати документ для завантаження.", {
          id: EXPORT_TOAST_ID,
        })
        return
      }
      const form = new FormData()
      form.set(
        "file",
        new Blob([new Uint8Array(outgoing.bytes)], { type: DOCX_MIME }),
        "document.docx"
      )
      form.set("title", title)
      form.set("templateId", templateId)
      const response = await fetch("/api/exports", {
        method: "POST",
        body: form,
      })
      const result = (await response.json()) as {
        message?: string
        downloadUrl?: string
      }
      if (!response.ok) {
        toast.error(result.message ?? "Не вдалося зберегти документ.", {
          id: EXPORT_TOAST_ID,
        })
        return
      }
      toast.success(
        "DOCX збережено у вашому профілі. Завантаження розпочато.",
        { id: EXPORT_TOAST_ID }
      )
      if (result.downloadUrl) {
        const link = window.document.createElement("a")
        link.href = result.downloadUrl
        link.download = ""
        link.click()
      }
    } catch {
      toast.error("Не вдалося підключитися до сервера. Спробуйте ще раз.", {
        id: EXPORT_TOAST_ID,
      })
    } finally {
      setPending(false)
    }
  }, [editor, pending, saveHandler, templateId, title])

  const value = React.useMemo(
    () => ({ exportDocument, pending }),
    [exportDocument, pending]
  )

  return (
    <DocumentExportContext.Provider value={value}>
      {children}
    </DocumentExportContext.Provider>
  )
}
