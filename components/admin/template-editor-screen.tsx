"use client"

import Link from "next/link"
import { DocumentEditor } from "@/components/documents/docx-editor/document-editor"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function TemplateEditorScreen({
  templateId,
  title,
  saveHandler,
}: {
  templateId: string
  title: string
  saveHandler: (formData: FormData) => Promise<{ ok: boolean; message: string }>
}) {
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/admin/templates"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          ← До шаблонів
        </Link>
        <span className="text-xs text-muted-foreground">
          Зміни документа зберігаються кнопкою «Зберегти шаблон» у тулбарі редактора
        </span>
      </div>
      <div className="flex items-stretch gap-4">
        <div className="min-w-0 flex-1">
          <DocumentEditor
            templateId={templateId}
            title={title}
            docxUrl={`/api/admin/templates/${templateId}/docx`}
            mode="template"
            exportHandler={saveHandler}
          />
        </div>
      </div>
    </div>
  )
}
