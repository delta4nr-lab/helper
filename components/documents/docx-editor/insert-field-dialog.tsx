"use client"

import * as React from "react"
import { useDocxEditor } from "@docx-editor.dev/react"
import type { DocRange } from "@docx-editor.dev/core/contracts/editor"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { CUSTOM_FIELD_TYPES, type CustomFieldTypeId } from "./field-types"
import { insertFieldIntoDocument } from "./insert-field"

// Той самий формат ключа, що й у TemplateField (lib/templates/actions.ts).
const TAG_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/

// Діалог вставки кастомного поля (content control) у місце курсора/виділення.
// Виділення фіксується при відкритті: модальність його не змінює, а вставка
// мусить піти саме туди, де був курсор. Один exec — один undo-крок.
export function InsertFieldDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const editor = useDocxEditor()
  const [typeId, setTypeId] = React.useState<CustomFieldTypeId>(CUSTOM_FIELD_TYPES[0].id)
  const [tag, setTag] = React.useState("")
  const [title, setTitle] = React.useState("")
  const [selectedText, setSelectedText] = React.useState<string | null>(null)
  const [hasSelection, setHasSelection] = React.useState(true)
  // Теги наявних контролів — для перевірки унікальності.
  const [takenTags, setTakenTags] = React.useState<ReadonlySet<string>>(new Set())

  const selectionRef = React.useRef<DocRange | null>(null)

  // Знімок стану на відкриття: діалог модальний, документ під час введення
  // не змінюється, тож виділення і теги контролів досить прочитати один раз.
  React.useEffect(() => {
    if (!open || !editor) return
    selectionRef.current = editor.query({ type: "selection" })
    setHasSelection(selectionRef.current !== null)
    setSelectedText(editor.query({ type: "selectedText" }).trim() || null)
    setTakenTags(
      new Set(
        editor
          .query({ type: "contentControls" })
          .map((control) => control.tag)
          .filter((value): value is string => Boolean(value))
      )
    )
    setTypeId(CUSTOM_FIELD_TYPES[0].id)
    setTag("")
    setTitle("")
  }, [open, editor])

  const type = CUSTOM_FIELD_TYPES.find((item) => item.id === typeId) ?? CUSTOM_FIELD_TYPES[0]

  const normalizedTag = tag.trim()
  const normalizedTitle = title.trim()
  const tagError =
    normalizedTag && !TAG_PATTERN.test(normalizedTag) ? "Ключ: латиниця, цифри та _, з літери." : null
  const duplicateError =
    !tagError && normalizedTag && takenTags.has(normalizedTag)
      ? "Поле з таким ключем уже вставлено."
      : null
  const canInsert =
    hasSelection && normalizedTag !== "" && normalizedTitle !== "" && !tagError && !duplicateError

  function handleInsert() {
    if (!editor || !canInsert || !selectionRef.current) return
    // Без options: у модалі живе виділення == захопленому, а рушій сам бере
    // свій selection з точними офсетами (без round-trip через якорі).
    const result = insertFieldIntoDocument(editor, {
      subtype: type.subtype,
      tag: normalizedTag,
      title: normalizedTitle,
    })
    if (!result.ok) {
      toast.error(result.message)
      return
    }
    toast.success(`Поле «${normalizedTitle}» вставлено.`)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Додати поле заповнення</DialogTitle>
          <DialogDescription>
            {hasSelection
              ? selectedText
                ? `Поле обгортатиме виділений текст: «${selectedText.length > 40 ? `${selectedText.slice(0, 40)}…` : selectedText}».`
                : typeId === "plainText"
                  ? "Поле вставиться в місці курсора й одразу показуватиме назву."
                  : "Поле вставиться в місці курсора."
              : "Поставте курсор у документ і спробуйте ще раз."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Тип поля</Label>
            <div className="flex gap-1">
              {CUSTOM_FIELD_TYPES.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  variant={item.id === typeId ? "secondary" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setTypeId(item.id)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{type.hint}</p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="insert-field-tag">Ключ (тег)</Label>
            <Input
              id="insert-field-tag"
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  handleInsert()
                }
              }}
              placeholder="customer_name"
              autoFocus
            />
            {(tagError ?? duplicateError) && (
              <p className="text-xs text-destructive">{tagError ?? duplicateError}</p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="insert-field-title">Назва поля</Label>
            <Input
              id="insert-field-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  handleInsert()
                }
              }}
              placeholder="ПІБ клієнта"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleInsert} disabled={!canInsert}>
            Вставити
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
