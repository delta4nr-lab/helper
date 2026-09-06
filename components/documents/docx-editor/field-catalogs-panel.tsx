"use client"

import * as React from "react"
import { useDocxEditor } from "@docx-editor.dev/react"
import { Minus, PanelRightClose, PanelRightOpen, Plus, Search } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  FIELD_CATALOGS,
  getCadetTag,
  getNumberedFieldTitle,
  getStaffTag,
  type CatalogField,
  type FieldCatalog,
  type FieldSource,
} from "./field-catalogs"
import { insertFieldIntoDocument } from "./insert-field"

// Панель готових полів довідників (лише в режимі шаблона): ТАБИ за джерелами
// (Персонал / Курсанти), пошук за назвою, клік вставляє content control у
// каретку/виділення через спільний insertFieldIntoDocument. Номерні довідники
// мають лічильник записів: тег і назва поля будуються з поточного індексу
// (staff.2.fullName → «ПІБ (2)», cadet.1.rank → «Звання (1)»).
// Згортається до вузької рейки, щоб не займати місце поруч з іншими панелями.
export function FieldCatalogsPanel() {
  const editor = useDocxEditor()
  const [collapsed, setCollapsed] = React.useState(false)
  const [activeSource, setActiveSource] = React.useState<FieldSource>(
    FIELD_CATALOGS[0]?.source ?? "personnel"
  )
  const [search, setSearch] = React.useState("")
  // Індекс запису номерного довідника, стан по catalog.id — кожен
  // numbered-довідник має власний лічильник.
  const [indexes, setIndexes] = React.useState<Record<string, number>>({})

  const sources = [...new Set(FIELD_CATALOGS.map((catalog) => catalog.source))]
  const activeCatalogs = FIELD_CATALOGS.filter(
    (catalog) => catalog.source === activeSource
  )
  const needle = search.trim().toLowerCase()

  function getIndex(catalog: FieldCatalog): number {
    return indexes[catalog.id] ?? 1
  }

  function setIndex(catalog: FieldCatalog, index: number) {
    const max = catalog.maxIndex ?? 5
    setIndexes((prev) => ({ ...prev, [catalog.id]: Math.min(Math.max(1, index), max) }))
  }

  function handleInsert(catalog: FieldCatalog, field: CatalogField) {
    if (!editor) return
    const tag = catalog.numbered
      ? catalog.source === "cadet"
        ? getCadetTag(getIndex(catalog), field.id)
        : getStaffTag(getIndex(catalog), field.id)
      : field.tag
    const title = catalog.numbered
      ? getNumberedFieldTitle(field.label, getIndex(catalog))
      : field.label
    if (!tag) return
    // Заготовлене поле замінює виділений текст (замість обгортання його
    // вмістом): виділена область стає полем-заготовкою з назвою поля.
    const result = insertFieldIntoDocument(
      editor,
      { subtype: field.subtype, tag, title },
      { replaceSelection: true }
    )
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    toast.success(`Поле «${title}» вставлено.`)
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
          {sources.length === 1 ? FIELD_CATALOGS[0].title : "Поля"}
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

      {sources.length > 1 && (
        <div className="flex gap-1 border-b px-2 py-2">
          {sources.map((source) => {
            const catalog = FIELD_CATALOGS.find((c) => c.source === source)
            const active = source === activeSource
            return (
              <Button
                key={source}
                type="button"
                variant={active ? "secondary" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => {
                  setActiveSource(source)
                  setSearch("")
                }}
              >
                {catalog?.tabLabel ?? catalog?.title ?? source}
              </Button>
            )
          })}
        </div>
      )}

      <div className="border-b px-2 py-2">
        <div className="relative">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Пошук поля"
            className="h-8 pr-8"
          />
          <Search className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
        {activeCatalogs.map((catalog) => {
          const index = getIndex(catalog)
          const max = catalog.maxIndex ?? 5
          const filteredFields = catalog.fields.filter((field) =>
            needle ? field.label.toLowerCase().includes(needle) : true
          )
          let lastGroup: string | undefined
          return (
            <section key={catalog.id} className="flex flex-col gap-1.5 pb-1 last:pb-0">
              {catalog.numbered && (
                <div className="flex items-center justify-between gap-1 rounded-md border border-border px-1 py-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index <= 1}
                    onClick={() => setIndex(catalog, index - 1)}
                    title="Попередній запис"
                    aria-label="Попередній запис"
                  >
                    <Minus className="size-4" />
                  </Button>
                  <span
                    className="text-sm font-medium tabular-nums"
                    title="Поля вставляться для запису з цим номером"
                  >
                    {index}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={index >= max}
                    onClick={() => setIndex(catalog, index + 1)}
                    title="Наступний запис"
                    aria-label="Наступний запис"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              )}
              {filteredFields.map((field) => {
                const Icon = field.icon
                const showGroup = Boolean(field.group) && field.group !== lastGroup
                lastGroup = field.group
                return (
                  <React.Fragment key={`${catalog.id}:${field.id}`}>
                    {showGroup && (
                      <h4 className="px-1 pt-1 text-xs font-medium text-muted-foreground">
                        {field.group}
                      </h4>
                    )}
                    <button
                      type="button"
                      onClick={() => handleInsert(catalog, field)}
                      // Каретка редактора має лишитися на місці: не віддаємо фокус кнопці
                      onMouseDown={(event) => event.preventDefault()}
                      className="flex w-full items-center gap-2 rounded-md border border-border px-2 py-1.5 text-left text-sm transition-colors hover:border-primary/50 hover:bg-muted/50"
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{field.label}</span>
                    </button>
                  </React.Fragment>
                )
              })}
              {filteredFields.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">Не знайдено.</p>
              )}
              {catalog.hint && (
                <p className="mt-1 px-1 text-xs text-muted-foreground">{catalog.hint}</p>
              )}
            </section>
          )
        })}
      </div>
    </aside>
  )
}
