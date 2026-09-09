"use client"

// Діалог «Додати кастомне поле»: вставляє FieldNode у позицію каретки
// через insertCustomNode (одна транзакція, один undo-крок — документація
// «Insert, update, remove»). Уся конкретика поля (key) живе в офіційному
// data payload, w:tag = acme:field — коротка фіксована ідентичність.
// Стан форми живе у внутрішньому компоненті, який розмонтовується разом
// із DialogContent, — діалог щоразу відкривається чистим, без скидання
// стану в ефекті.

import * as React from "react"
import { customNodesOf, encodeCustomNodeTag, insertCustomNode } from "@docx-editor.dev/pro"
import { useDocxEditor } from "@docx-editor.dev/react"
import { toast } from "sonner"

import { FIELD_TAG_PREFIX, FieldNode } from "@/lib/docx-editor/field-node"
import {
  placeCaretBesideField,
  suspendFieldSelect,
} from "@/components/documents/docx-editor/field-select"

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

// Той самий формат ключа, що й у старій системі полів (спільний з edit-формою).
export const FIELD_KEY_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/

const LOG = "[field-insert]"

export function FieldInsertDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // Чи була в цьому відкритті успішна вставка: тоді Base UI не має
  // повертати фокус на тулбар (finalFocus: false — «do not move focus»),
  // каретку за нодою ставить placeCaretBesideField сам.
  const insertedRef = React.useRef(false)

  React.useEffect(() => {
    if (open) insertedRef.current = false
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        finalFocus={() => (insertedRef.current ? false : true)}
      >
        <DialogHeader>
          <DialogTitle>Додати кастомне поле</DialogTitle>
          <DialogDescription>
            Поле вставиться в поточну позицію курсора: назва видно в документі, далі її можна
            правити прямо в тексті.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <FieldInsertForm
            onInserted={() => {
              insertedRef.current = true
            }}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function FieldInsertForm({
  onInserted,
  onDone,
}: {
  onInserted: () => void
  onDone: () => void
}) {
  const editor = useDocxEditor()
  const [key, setKey] = React.useState("")
  const [title, setTitle] = React.useState("")

  // customNodesOf читає документ щоразу заново («no change event, re-read
  // after an edit»), тому наявні ключі збираємо на кожен рендер форми.
  // Ідентичність — key в attrs після fromDocx (свідомий редагований варіант
  // без payload).
  const takenKeys = React.useMemo(() => {
    if (!editor) return new Set<string>()
    return new Set(
      customNodesOf(editor)
        .map((node) => (typeof node.attrs.key === "string" ? node.attrs.key : null))
        .filter((value): value is string => Boolean(value))
    )
  }, [editor])

  const normalizedKey = key.trim()
  const normalizedTitle = title.trim()
  const keyError =
    normalizedKey && !FIELD_KEY_PATTERN.test(normalizedKey)
      ? "Ключ: латиниця, цифри та _, з літери."
      : null
  const duplicateError =
    !keyError && normalizedKey && takenKeys.has(normalizedKey)
      ? "Поле з таким ключем уже вставлено."
      : null
  // Word лімітує w:tag 64 символами; валідуємо точно ту саму схему attrs,
  // яку зробить вставка (лише key — fieldType/personInstance виводяться
  // з key, personnelId дописується прив'язкою).
  const tagOverflowError =
    !keyError && normalizedKey
      ? encodeCustomNodeTag(FIELD_TAG_PREFIX, FieldNode.name, { key: normalizedKey }).ok
        ? null
        : "Ключ завеликий для тега поля (ліміт Word — 64 символи)."
      : null
  const canSubmit =
    editor !== null &&
    normalizedKey !== "" &&
    normalizedTitle !== "" &&
    !keyError &&
    !duplicateError &&
    !tagOverflowError

  async function handleInsert() {
    if (!editor || !canSubmit) return
    // Вставка + розміщення каретки — один блок: авто-виділення FieldSelect
    // призупинено на весь цей час (bounceSuspend-патерн), інакше воно
    // перебиває поставлену каретку; placeCaretBesideField знімає
    // призупинення у finally.
    suspendFieldSelect(true)
    // Виділений текст замінюється нодою: insertCustomNode вставляє в точку
    // head виділення без видалення (перевірено в імплементації пакета),
    // тому спершу очищаємо виділення публічною командою paste { text: "" }
    // («Insert the clipboard payload at the selection, replacing it» —
    // payload аргументом, системний буфер не чіпається); відмова →
    // fallback cut («delete it», мінус — текст іде в буфер обміну).
    const snapshot = editor.snapshot()
    if (!snapshot.selectionCollapsed) {
      let cleared = editor.exec({ type: "paste", text: "" })
      if (!cleared.ok) {
        console.info(LOG, "paste-clear відхилено → fallback cut →", {
          code: cleared.code,
          reason: cleared.reason,
        })
        cleared = editor.exec({ type: "cut" })
      }
      if (!cleared.ok) {
        console.info(LOG, "очищення виділення не вдалося →", {
          code: cleared.code,
          reason: cleared.reason,
        })
      } else {
        console.info(LOG, "виділення очищено →", {
          collapsed: editor.snapshot().selectionCollapsed,
        })
      }
    }
    // Ідентичність — один ключ в attrs → w:tag; чіп без payload, тому
    // редаговується прямо в документі; відмова движка несе reason і code.
    const result = insertCustomNode(editor, FieldNode, {
      attrs: { key: normalizedKey },
      text: normalizedTitle,
      alias: normalizedTitle,
      lock: false,
    })
    if (!result.ok) {
      suspendFieldSelect(false)
      toast.error(result.reason ?? "Не вдалося вставити поле.")
      return
    }
    toast.success(`Поле «${normalizedTitle}» вставлено.`)
    onInserted()
    onDone()
    // Після закриття діалога: фокус движка (placeCaretBesideField робить
    // surface.focus() сам) і каретка за щойно вставленою нодою.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => void placeCaretBesideField(editor))
    )
  }

  return (
    <>
      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="field-key">Ключ (тег)</Label>
          <Input
            id="field-key"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                handleInsert()
              }
            }}
            placeholder="date"
            autoFocus
          />
          {(keyError ?? duplicateError) && (
            <p className="text-xs text-destructive">{keyError ?? duplicateError}</p>
          )}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="field-title">Назва поля</Label>
          <Input
            id="field-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                handleInsert()
              }
            }}
            placeholder="Дата"
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" onClick={handleInsert} disabled={!canSubmit}>
          Вставити
        </Button>
      </DialogFooter>
    </>
  )
}
