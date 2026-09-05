"use client"

import * as React from "react"
import { useDocxEditor } from "@docx-editor.dev/react"
import { PanelRightClose, PanelRightOpen } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { FIELD_CATALOGS, type CatalogField } from "./field-catalogs"
import { insertFieldIntoDocument } from "./insert-field"

// Панель готових полів довідників (лише в режимі шаблона): клік вставляє
// content control у каретку/виділення через спільний insertFieldIntoDocument.
// Згортається до вузької рейки, щоб не займати місце поруч з іншими панелями.
export function FieldCatalogsPanel() {
  const editor = useDocxEditor()
  const [collapsed, setCollapsed] = React.useState(false)

  function handleInsert(field: CatalogField) {
    if (!editor) return
    // Заготовлене поле замінює виділений текст (замість обгортання його
    // вмістом): виділена область стає полем-заготовкою з назвою поля.
    const result = insertFieldIntoDocument(
      editor,
      {
        subtype: field.subtype,
        tag: field.tag,
        title: field.label,
      },
      { replaceSelection: true }
    )
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    toast.success(`Поле «${field.label}» вставлено.`)
  }

  if (collapsed) {
    return (
      <aside className="flex w-9 shrink-0 flex-col items-center border-l border-border/50 bg-card py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(false)}
          title="Показати поля довідників"
          aria-label="Показати поля довідників"
        >
          <PanelRightOpen className="size-4" />
        </Button>
      </aside>
    )
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col overflow-hidden border-l border-border/50 bg-card">
      <div className="flex items-center justify-between gap-1 border-b px-2.5 py-2">
        <span className="truncate text-sm font-semibold">
          {FIELD_CATALOGS.length === 1 ? FIELD_CATALOGS[0].title : "Поля"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(true)}
          title="Згорнути панель"
          aria-label="Згорнути панель"
        >
          <PanelRightClose className="size-4" />
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
        {FIELD_CATALOGS.map((catalog) => (
          <section key={catalog.id} className="flex flex-col gap-1.5 pb-1 last:pb-0">
            {FIELD_CATALOGS.length > 1 && (
              <h4 className="px-1 pt-1 text-xs font-medium text-muted-foreground">{catalog.title}</h4>
            )}
            {catalog.fields.map((field) => {
              const Icon = field.icon
              return (
                <button
                  key={`${catalog.id}:${field.id}`}
                  type="button"
                  onClick={() => handleInsert(field)}
                  // Каретка редактора має лишитися на місці: не віддаємо фокус кнопці
                  onMouseDown={(event) => event.preventDefault()}
                  className="flex w-full items-center gap-2 rounded-md border border-border px-2 py-1.5 text-left text-sm transition-colors hover:border-primary/50 hover:bg-muted/50"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{field.label}</span>
                </button>
              )
            })}
            {catalog.hint && <p className="mt-1 px-1 text-xs text-muted-foreground">{catalog.hint}</p>}
          </section>
        ))}
      </div>
    </aside>
  )
}
