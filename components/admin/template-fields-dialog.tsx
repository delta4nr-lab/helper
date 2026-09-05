"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, TableProperties, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  createTemplateFieldAction,
  deleteTemplateFieldAction,
  moveTemplateFieldAction,
  updateTemplateFieldAction,
} from "@/lib/templates/actions"
import { TEMPLATE_FIELD_TYPES } from "@/lib/templates/types"
import {
  COURSE_FIELD_LABELS,
  type CourseRecordTextField,
} from "@/lib/courses/types"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type TemplateFieldRow = {
  id: string
  key: string
  label: string
  _type: string
  required: boolean
  placeholder: string | null
  sortOrder: number
}

function typeLabel(type: string): string {
  if (type.startsWith("course:")) {
    const field = type.slice("course:".length)
    return `${COURSE_FIELD_LABELS[field as CourseRecordTextField | "orderNumber"] ?? field} (курс)`
  }
  switch (type) {
    case "text":
      return "Текст"
    case "date":
      return "Дата"
    case "number":
      return "Число"
    case "person":
      return "ПІБ (персонал)"
    case "position":
      return "Посада (персонал)"
    case "rank":
      return "Звання (персонал)"
    case "signature":
      return "Підпис (персонал)"
    default:
      return type
  }
}

type FieldForm = {
  key: string
  label: string
  _type: string
  required: boolean
  placeholder: string
}

const emptyForm = (): FieldForm => ({ key: "", label: "", _type: "text", required: true, placeholder: "" })

function TypeSelect({ value, onChange, id }: { value: string; onChange: (type: string) => void; id: string }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="border-input bg-background flex h-8 w-full rounded-md border px-2 text-sm"
    >
      <optgroup label="Базові">
        <option value="text">Текст</option>
        <option value="date">Дата</option>
        <option value="number">Число</option>
      </optgroup>
      <optgroup label="Персонал">
        <option value="person">ПІБ (персонал)</option>
        <option value="position">Посада (персонал)</option>
        <option value="rank">Звання (персонал)</option>
        <option value="signature">Підпис (персонал)</option>
      </optgroup>
      <optgroup label="Курс (активний курс)">
        {TEMPLATE_FIELD_TYPES.filter((type) => type.startsWith("course:")).map((type) => (
          <option key={type} value={type}>
            {typeLabel(type)}
          </option>
        ))}
      </optgroup>
    </select>
  )
}

export function TemplateFieldsDialog({
  templateId,
  fields,
}: {
  templateId: string
  fields: TemplateFieldRow[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editForm, setEditForm] = React.useState<FieldForm>(emptyForm())
  const [adding, setAdding] = React.useState(false)
  const [addForm, setAddForm] = React.useState<FieldForm>(emptyForm())

  async function run(action: () => Promise<{ ok: boolean; message: string }>) {
    setSaving(true)
    const result = await action()
    setSaving(false)
    toast[result.ok ? "success" : "error"](result.message)
    if (result.ok) router.refresh()
    return result.ok
  }

  async function handleAdd() {
    if (adding) return
    setAdding(true)
    const ok = await run(() =>
      createTemplateFieldAction(templateId, {
        key: addForm.key,
        label: addForm.label,
        _type: addForm._type,
        required: addForm.required,
        placeholder: addForm.placeholder.trim() || null,
      })
    )
    setAdding(false)
    if (ok) setAddForm(emptyForm())
  }

  async function handleSaveEdit() {
    if (!editingId || saving) return
    setSaving(true)
    const ok = await run(() =>
      updateTemplateFieldAction(editingId, {
        label: editForm.label,
        _type: editForm._type,
        required: editForm.required,
        placeholder: editForm.placeholder.trim() || null,
      })
    )
    setSaving(false)
    if (ok) setEditingId(null)
  }

  return (
    <>
      <Button
        type="button"
        variant={open ? "secondary" : "outline"}
        size="sm"
        onClick={() => setOpen(true)}
      >
        <TableProperties className="size-4" />
        Поля заповнення
        <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground">{fields.length}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Поля заповнення шаблону</DialogTitle>
            <DialogDescription>
              Поля = content controls у DOCX (тег = ключ). Порядок — у якому вони показуються під час заповнення.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 overflow-y-auto rounded-lg border">
            {fields.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Полів ще немає — додайте перше нижче.
              </p>
            ) : (
              <ul className="divide-y">
                {fields.map((field, index) => (
                  <li key={field.id} className="px-3 py-2.5 text-sm">
                    {editingId === field.id ? (
                      <div className="grid gap-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="grid gap-1">
                            <Label className="text-xs">Назва поля</Label>
                            <Input
                              value={editForm.label}
                              onChange={(event) => setEditForm({ ...editForm, label: event.target.value })}
                            />
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-xs">Тип</Label>
                            <TypeSelect
                              id={`edit-type-${field.id}`}
                              value={editForm._type}
                              onChange={(_type) => setEditForm({ ...editForm, _type })}
                            />
                          </div>
                        </div>
                        <div className="grid gap-1">
                          <Label className="text-xs">Плейсхолдер</Label>
                          <Input
                            value={editForm.placeholder}
                            onChange={(event) => setEditForm({ ...editForm, placeholder: event.target.value })}
                          />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={editForm.required}
                            onChange={(event) => setEditForm({ ...editForm, required: event.target.checked })}
                            className="size-4 accent-primary"
                          />
                          Обовʼязкове
                        </label>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => setEditingId(null)}>
                            Скасувати
                          </Button>
                          <Button type="button" size="sm" onClick={() => void handleSaveEdit()} disabled={saving}>
                            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                            Зберегти
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium">{field.label}</span>
                            {field.required && (
                              <span className="rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
                                обовʼязкове
                              </span>
                            )}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {field.key} · {typeLabel(field._type)}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title="Вгору"
                          disabled={index === 0 || saving}
                          onClick={() => void run(() => moveTemplateFieldAction(field.id, "up"))}
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title="Вниз"
                          disabled={index === fields.length - 1 || saving}
                          onClick={() => void run(() => moveTemplateFieldAction(field.id, "down"))}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title="Редагувати"
                          onClick={() => {
                            setEditingId(field.id)
                            setEditForm({
                              key: field.key,
                              label: field.label,
                              _type: field._type,
                              required: field.required,
                              placeholder: field.placeholder ?? "",
                            })
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title="Видалити поле"
                          onClick={() => void run(() => deleteTemplateFieldAction(field.id))}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Додавання нового поля */}
          <div className="rounded-lg border p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Plus className="size-3.5" />
              Нове поле
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <Label htmlFor="add-key" className="text-xs">
                  Ключ (латиницею)
                </Label>
                <Input
                  id="add-key"
                  value={addForm.key}
                  onChange={(event) => setAddForm({ ...addForm, key: event.target.value })}
                  placeholder="person_1"
                  className="h-8"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="add-label" className="text-xs">
                  Назва поля
                </Label>
                <Input
                  id="add-label"
                  value={addForm.label}
                  onChange={(event) => setAddForm({ ...addForm, label: event.target.value })}
                  placeholder="ПІБ командира"
                  className="h-8"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="add-type" className="text-xs">
                  Тип
                </Label>
                <TypeSelect
                  id="add-type"
                  value={addForm._type}
                  onChange={(_type) => setAddForm({ ...addForm, _type })}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="add-placeholder" className="text-xs">
                  Плейсхолдер
                </Label>
                <Input
                  id="add-placeholder"
                  value={addForm.placeholder}
                  onChange={(event) => setAddForm({ ...addForm, placeholder: event.target.value })}
                  className="h-8"
                />
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={addForm.required}
                  onChange={(event) => setAddForm({ ...addForm, required: event.target.checked })}
                  className="size-4 accent-primary"
                />
                Обовʼязкове
              </label>
              <Button type="button" size="sm" onClick={() => void handleAdd()} disabled={adding}>
                {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Додати поле
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
