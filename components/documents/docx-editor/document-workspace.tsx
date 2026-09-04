"use client"

import * as React from "react"
import { DocxEditor, useContentControl, useDocxEditor } from "@docx-editor.dev/react"
import { Download, FileCheck2, Highlighter, Loader2, ScanText } from "lucide-react"

import "@docx-editor.dev/core/styles/editor.css"

import { FillPanel } from "@/components/documents/docx-editor/fill-panel"
import { bounceSuspend } from "@/components/documents/docx-editor/bounce-suspend"
import type { EditorField, EditorPersonnel } from "@/components/documents/types"
import { useTheme } from "@/components/theme-provider"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

type WorkspaceProps = {
  templateId: string
  title: string
  fields: EditorField[]
  personnel: EditorPersonnel[]
}

type ExportMessage = { ok: boolean; text: string }

// Режим «лише заповнення»: каретка мусить жити лише всередині полів (content controls).
// Рушій обмежує тільки Tab-навігацію, тому доповнюємо синхронною підпискою:
// щойно каретка покидає поле (клік поза ним) — одразу повертаємо її в найближче поле,
// до того, як користувач встигне щось надрукувати. На час програмного заповнення
// підпису відскік призупинено (bounceSuspend), щоб не перехоплювати sélection-зміни.
function FormFillToggle() {
  const editor = useDocxEditor()
  const { formFill, toggleFormFill, controls } = useContentControl()

  React.useEffect(() => {
    if (!formFill || !editor) return
    return editor.on("selectionChange", (snapshot) => {
      if (bounceSuspend.active || !editor.surface || !snapshot.editable) return
      const atControl = editor.query({ type: "contentControlAt" })
      if (atControl) return
      editor.surface.contentControls.navigate("next")
    })
  }, [editor, formFill])

  function handleToggle() {
    const turningOn = !formFill
    toggleFormFill()
    if (turningOn && editor?.surface && !editor.query({ type: "contentControlAt" })) {
      editor.surface.contentControls.navigate("next")
    }
  }

  return (
    <Button
      type="button"
      variant={formFill ? "secondary" : "ghost"}
      size="sm"
      onClick={handleToggle}
      disabled={controls.length === 0}
      title="Режим заповнення: редагування лише всередині полів"
    >
      <ScanText className="size-4" />
      Заповнення
    </Button>
  )
}

// Підсвітка полів: boundary-хром на всіх контролах — видно, що треба заповнювати.
// Увімкнена за замовчуванням; кнопка перемикає. Стан повторно застосовується при
// кожній версії документа: surface з'являється після завантаження файлу, а
// setShowAll — idempotentний стан хрому (без reflow).
function HighlightToggle({ docVersion }: { docVersion: number }) {
  const editor = useDocxEditor()
  const [on, setOn] = React.useState(true)

  React.useEffect(() => {
    if (!editor?.surface) return
    editor.surface.contentControls.setShowAll(on)
  }, [editor, editor?.surface, on, docVersion])

  return (
    <Button
      type="button"
      variant={on ? "secondary" : "ghost"}
      size="sm"
      onClick={() => setOn((value) => !value)}
      title="Підсвітка полів для заповнення"
    >
      <Highlighter className="size-4" />
      Підсвітка
    </Button>
  )
}

function PageSetupButton({ onOpen }: { onOpen: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onOpen} title="Розмір сторінки й поля">
      <FileCheck2 className="size-4" />
      Сторінка
    </Button>
  )
}

// Експорт: editor.save() → збереження в історії на сервері → завантаження файлу.
function ExportButton({
  templateId,
  title,
  onMessage,
}: {
  templateId: string
  title: string
  onMessage: (message: ExportMessage) => void
}) {
  const editor = useDocxEditor()
  const [pending, setPending] = React.useState(false)

  async function handleExport() {
    if (!editor || pending) return
    setPending(true)
    onMessage({ ok: true, text: "Формування DOCX..." })
    try {
      const buffer = await editor.save()
      const form = new FormData()
      form.set("templateId", templateId)
      form.set("title", title)
      form.set("file", new Blob([buffer], { type: DOCX_MIME }), "document.docx")

      const response = await fetch("/api/exports", { method: "POST", body: form })
      const result = (await response.json()) as { message?: string; downloadUrl?: string }
      if (!response.ok) {
        onMessage({ ok: false, text: result.message ?? "Не вдалося зберегти документ." })
        return
      }
      onMessage({ ok: true, text: "DOCX збережено у вашому профілі. Завантаження розпочато." })
      if (result.downloadUrl) {
        const link = window.document.createElement("a")
        link.href = result.downloadUrl
        link.download = ""
        link.click()
      }
    } catch {
      onMessage({ ok: false, text: "Не вдалося підключитися до сервера. Спробуйте ще раз." })
    } finally {
      setPending(false)
    }
  }

  return (
    <Button type="button" size="sm" onClick={handleExport} disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      Експорт DOCX
    </Button>
  )
}

// Робоча область: DocxEditor.Root (контекст) + хром редактора + панель заповнення.
// Тематизація: бібліотека чекає класи docx-editor (світлі токени) і docx-editor.dark
// (темні токени --doc-*) на спільному корені хрому, тому обгортаємо хром обгорткою,
// що слідкує за темою сайту. Папір лишається білим; документ не залишає браузер.
export default function DocumentWorkspace({ templateId, title, fields, personnel }: WorkspaceProps) {
  const [bytes, setBytes] = React.useState<Uint8Array | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [docVersion, setDocVersion] = React.useState(0)
  const [pageSetupOpen, setPageSetupOpen] = React.useState(false)
  const [message, setMessage] = React.useState<ExportMessage | null>(null)
  const { resolvedTheme } = useTheme()

  React.useEffect(() => {
    let cancelled = false
    fetch(`/api/templates/${templateId}/docx`)
      .then(async (response) => {
        if (!response.ok) {
          const result = (await response.json().catch(() => null)) as { message?: string } | null
          throw new Error(result?.message ?? "Не вдалося завантажити шаблон.")
        }
        return response.arrayBuffer()
      })
      .then((buffer) => {
        if (!cancelled) setBytes(new Uint8Array(buffer))
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Не вдалося завантажити шаблон.")
      })
    return () => {
      cancelled = true
    }
  }, [templateId])

  if (loadError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {loadError}
      </div>
    )
  }

  if (!bytes) {
    return (
      <div className="flex h-96 items-center justify-center gap-2 rounded-lg border text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Завантаження шаблону...
      </div>
    )
  }

  return (
    <DocxEditor.Root document={bytes} mode="edit" onChange={() => setDocVersion((v) => v + 1)}>
      <div className={cn("docx-editor flex min-h-0 flex-1 flex-col", resolvedTheme === "dark" && "dark")}>
      <div className="flex flex-wrap items-center gap-2 bg-background/95 px-3 py-2 backdrop-blur">
        <span className="mr-auto truncate text-sm font-semibold" title={title}>
          {title}
        </span>
        <HighlightToggle docVersion={docVersion} />
        <FormFillToggle />
        <PageSetupButton onOpen={() => setPageSetupOpen(true)} />
        <ExportButton templateId={templateId} title={title} onMessage={setMessage} />
      </div>

      {message && (
        <div
          className={`px-3 py-1.5 text-sm ${message.ok ? "text-muted-foreground" : "text-destructive"}`}
          role="status"
        >
          {message.text}
        </div>
      )}

      {/* Меню-бар і тулбар — у дефолтному оформленні бібліотеки.
          Comments/EditingMode приховано: коментарі й правки — Pro, режим змін не використовується */}
      <DocxEditor.Menu />

      <DocxEditor.Toolbar>
        <DocxEditor.Toolbar.Comments hidden />
        <DocxEditor.Toolbar.EditingMode hidden />
      </DocxEditor.Toolbar>
      <DocxEditor.HorizontalRuler />

        <div className="flex min-h-0 flex-1">
          <div className="relative min-w-0 flex-1">
            <DocxEditor.Viewport className="h-full">
              <DocxEditor.VerticalRuler />
              <DocxEditor.HeaderFooterChrome />
              <DocxEditor.NotesChrome />
              <DocxEditor.Content />
              <DocxEditor.HyperLink />
              <DocxEditor.ContextMenu />
              <DocxEditor.ContentControl />
            </DocxEditor.Viewport>
            <DocxEditor.Loading overlay />
          </div>
          <FillPanel fields={fields} personnel={personnel} docVersion={docVersion} />
        </div>
      </div>

      <DocxEditor.PageSetupDialog open={pageSetupOpen} onClose={() => setPageSetupOpen(false)} />
    </DocxEditor.Root>
  )
}
