"use client"

import Link from "next/link"
import { DocumentEditor } from "@/components/documents/docx-editor/document-editor"
import { TemplateFieldsDialog, type TemplateFieldRow } from "@/components/admin/template-fields-dialog"
import { FieldCatalogsPanel } from "@/components/documents/docx-editor/field-catalogs-panel"
import type { EditorPersonnel } from "@/components/documents/types"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function TemplateEditorScreen({
  templateId,
  title,
  fields,
  personnel,
  saveHandler,
}: {
  templateId: string
  title: string
  fields: TemplateFieldRow[]
  personnel: EditorPersonnel[]
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
            fields={fields.map((field) => ({ key: field.key, label: field.label, type: field._type }))}
            personnel={personnel}
            docxUrl={`/api/admin/templates/${templateId}/docx`}
            mode="template"
            exportHandler={saveHandler}
            titleActions={<TemplateFieldsDialog templateId={templateId} fields={fields} />}
            sidePanel={<FieldCatalogsPanel />}
          />
        </div>
      </div>
    </div>
  )
}
