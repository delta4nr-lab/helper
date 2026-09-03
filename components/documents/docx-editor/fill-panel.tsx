"use client"

import * as React from "react"
import { normalizeImageBytes, useDocxEditor } from "@docx-editor.dev/react"
import { ArrowLeftRight, Eraser, UserRound } from "lucide-react"

import { PersonPicker, type PersonPickerItem } from "@/components/documents/person-picker"
import { bounceSuspend } from "@/components/documents/docx-editor/bounce-suspend"
import type { EditorField, EditorPersonnel } from "@/components/documents/types"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// Спеціальні типи полів, що заповнюються з картки персоналії.
const PERSON_FIELD_TYPES = new Set(["person", "position", "rank", "signature"])

// Висота підпису в документі, pt (≈ 4em при 14pt шрифті).
const SIGNATURE_HEIGHT_PT = 54

function fullName(person: EditorPersonnel): string {
  return [person.lastName, person.firstName, person.middleName].filter(Boolean).join(" ")
}

// Група спеціальних полів: спільний числовий суфікс (напр. position_1 / rank_1 /
// signature_1 / person_1) або окремий ключ без суфікса.
type PersonGroup = {
  id: string
  label: string
  fields: EditorField[]
}

function groupFields(fields: EditorField[]): { groups: PersonGroup[]; simple: EditorField[] } {
  const byId = new Map<string, PersonGroup>()
  const simple: EditorField[] = []
  for (const field of fields) {
    if (!PERSON_FIELD_TYPES.has(field.type)) {
      simple.push(field)
      continue
    }
    const id = field.key.match(/_(\d+)$/)?.[1] ?? field.key
    let group = byId.get(id)
    if (!group) {
      group = { id, label: field.label, fields: [] }
      byId.set(id, group)
    }
    if (field.type === "person") group.label = field.label
    group.fields.push(field)
  }
  return { groups: Array.from(byId.values()), simple }
}

// Панель заповнення: групи полів зі штату + окремі текстові поля.
// Працює всередині DocxEditor.Root (використовує контекст редактора).
// docVersion зростає при кожній зміні документа — тригер переогляду контролів.
export function FillPanel({
  fields,
  personnel,
  docVersion,
}: {
  fields: EditorField[]
  personnel: EditorPersonnel[]
  docVersion: number
}) {
  const editor = useDocxEditor()

  const { groups, simple } = React.useMemo(() => groupFields(fields), [fields])

  // Теги контролів, наявні у документі (для позначки «немає в документі»).
  // docVersion — свідомий тригер перерахунку при кожній зміні документа.
  const presentTags = React.useMemo(() => {
    if (!editor) return new Set<string>()
    return new Set(editor.query({ type: "contentControls" }).map((c) => c.tag ?? "").filter(Boolean))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, docVersion])

  const [openPickerId, setOpenPickerId] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<Record<string, string>>({})
  const [simpleValues, setSimpleValues] = React.useState<Record<string, string>>({})
  const [status, setStatus] = React.useState<string | null>(null)
  // Теги контролів, заповнені даними (текст або підпис-картинка). Слухач change
  // нижче повертає назву полю, коли заповнений контрол спорожнів.
  const filledTags = React.useRef<Set<string>>(new Set())

  // Дефолтне значення поля — його назва. Коли користувач видаляє дані з поля
  // (текст або картинку підпису), полю автоматично повертається назва — поле
  // знову можна заповнити (хоч скільки разів). DOM перевіряємо після флешу
  // верстки (подвійний requestAnimationFrame): подія change летить до перекреслення.
  React.useEffect(() => {
    if (!editor) return
    let checkQueued = false
    const check = () => {
      checkQueued = false
      if (bounceSuspend.active) return
      for (const tag of filledTags.current) {
        const chrome = document.querySelector(`.docx-content-control-chrome[data-tag="${tag}"]`)
        const hasImage = chrome?.querySelector("[data-drawing-node-id]:not(.docx-image-selection-overlay)")
        const hasText = (chrome?.textContent ?? "").replace(/[\u200b\u2060]/g, "").trim() !== ""
        console.warn("[restore] check", tag, { hasImage: Boolean(hasImage), hasText, chromeText: (chrome?.textContent ?? "").slice(0, 30) })
        if (hasImage || hasText) continue
        filledTags.current.delete(tag)
        const label = fields.find((f) => f.key === tag)?.label
        const controlId = editor.query({ type: "contentControls", filter: { tag } })[0]?.id
        if (label && controlId) editor.surface?.contentControls.setValue(controlId, label)
      }
    }
    const onChange = () => {
      if (bounceSuspend.active || checkQueued) return
      checkQueued = true
      requestAnimationFrame(() => requestAnimationFrame(check))
    }
    return editor.on("change", onChange)
  }, [editor, fields])

  const pickerItems: PersonPickerItem[] = React.useMemo(
    () =>
      personnel.map((p) => ({
        id: p.id,
        name: fullName(p),
        position: p.position,
        rank: p.rank,
      })),
    [personnel]
  )

  // Підпис: зображення з картки персоналії → всередину поля-контрола (inline).
  // Контрол сам ховає назву, коли має вміст, а семантика поля зберігається у DOCX:
  // SDT з тегом залишається в документі разом із картинкою. Повторне заповнення
  // перезаписує вміст контрола, видалення картинки користувачем відстежує слухач
  // change (назва повертається автоматично).
  async function fillSignature(key: string, person: EditorPersonnel): Promise<boolean> {
    const surface = editor?.surface
    if (!surface || !person.signaturePath) return false
    const controlId = editor.query({ type: "contentControls", filter: { tag: key } })[0]?.id
    if (!controlId) return false
    const label = fields.find((f) => f.key === key)?.label ?? ""

    const response = await fetch(person.signaturePath)
    if (!response.ok) return false
    const normalized = normalizeImageBytes(new Uint8Array(await response.arrayBuffer()))
    if (!normalized.ok) return false

    bounceSuspend.begin()
    let ok = false
    try {
      // Скидаємо попередній вміст контрола (стара картка зникає разом із міткою)
      // і ставимо невидиму мітку: 12 нуль-шириних символів (U+2060/U+200B), біти
      // хешу controlId — унікальна послідовність, у абзаці зустрічається рівно
      // один раз. Мітка адресує каретку всередині контрола й лишається в документі
      // (невидима в прев'ю і в Word).
      filledTags.current.delete(key)
      const idNum = [...controlId].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 4096, 7)
      const marker = Array.from({ length: 12 }, (_, i) => ((idNum >> i) & 1 ? "\u200b" : "\u2060")).join("")
      if (!surface.contentControls.setValue(controlId, marker)) return false
      console.warn("[sig] marker set, controlId:", controlId)

      // Абзац мітки: коротке опитування, поки верстка флешне новий текст (зазвичай 1-й тик)
      let paraId: string | undefined
      for (let attempt = 0; attempt < 20 && !paraId; attempt++) {
        const found = editor.query({ type: "paragraphs" }).find((p) => p.paraId && p.text.includes(marker))
        paraId = found?.paraId
        if (!paraId) await new Promise((resolve) => setTimeout(resolve, 25))
      }
      if (!paraId) return false

      // Каретка на мітку (всередину контрола) → inline-зображення на її місці.
      // Якщо комірка вужча за картинку, движок сам пропорційно зменшить вставку.
      const anchored = editor.exec({ type: "setSelection", anchor: { paraId: paraId, search: marker } })
      console.warn("[sig] setSelection:", JSON.stringify(anchored), "paraId:", paraId)
      if (!anchored.ok) return false
      const result = await editor.executeImageCommand({
        type: "insertImage",
        data: normalized.bytes,
        mime: normalized.mime,
        widthPoints: Math.max(24, Math.round((normalized.widthPoints / normalized.heightPoints) * SIGNATURE_HEIGHT_PT)),
        heightPoints: SIGNATURE_HEIGHT_PT,
      })
      if (!result.ok) return false
      console.warn("[sig] inserted, selected:", JSON.stringify(editor.getSelectedImage()?.id ?? null))

      filledTags.current.add(key)
      ok = true
      return true
    } finally {
      bounceSuspend.end()
      // Невдала вставка не має лишати контрол з невидимою міткою — повертаємо назву
      if (!ok) surface.contentControls.setValue(controlId, label)
    }
  }
  function setValueByTag(key: string, value: string): boolean {
    if (!editor) return false
    const controls = editor.query({ type: "contentControls", filter: { tag: key } })
    let applied = controls.length > 0
    for (const control of controls) {
      if (!editor.surface?.contentControls.setValue(control.id, value)) applied = false
    }
    // Значення-дані переводять поле у стан «заповнене», назва — назад у «порожнє».
    if (applied) {
      const label = fields.find((f) => f.key === key)?.label
      if (value && value !== label) filledTags.current.add(key)
      else filledTags.current.delete(key)
    }
    return applied
  }

  // Вибір особи → заповнює всі поля групи (ПІБ, посада, звання, підпис).
  async function applyPerson(group: PersonGroup, personId: string) {
    const person = personnel.find((p) => p.id === personId)
    if (!person || !editor) return
    setSelected((prev) => ({ ...prev, [group.id]: personId }))
    setOpenPickerId(null)
    let signatureMissing = false
    let signatureFailed = false
    for (const field of group.fields) {
      const value =
        field.type === "person"
          ? fullName(person)
          : field.type === "position"
            ? person.position
            : field.type === "rank"
              ? person.rank
              : null
      if (value !== null) {
        setValueByTag(field.key, value)
      } else if (field.type === "signature") {
        if (!person.signaturePath) {
          signatureMissing = true
          continue
        }
        if (!(await fillSignature(field.key, person))) signatureFailed = true
      }
    }
    if (signatureMissing) setStatus(`У ${fullName(person)} немає підпису в картці персоналії`)
    else if (signatureFailed) setStatus(`Не вдалося вставити підпис ${fullName(person)}`)
    else setStatus(null)
  }

  // Скидання групи: усі поля повертаються до назв — setValue перезаписує вміст
  // контрола, включно з картинкою підпису всередині нього.
  function clearGroup(group: PersonGroup) {
    setSelected((prev) => {
      const next = { ...prev }
      delete next[group.id]
      return next
    })
    for (const field of group.fields) {
      setValueByTag(field.key, field.label)
    }
  }

  function fillSimple(field: EditorField) {
    const value = (simpleValues[field.key] ?? "").trim()
    if (value) setValueByTag(field.key, value)
  }

  function resetSimple(field: EditorField) {
    setSimpleValues((prev) => ({ ...prev, [field.key]: "" }))
    setValueByTag(field.key, field.label)
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-l border-border/50 bg-background">
      <div className="border-b border-border/50 px-3 py-2 text-sm font-semibold">Заповнення</div>

      {groups.length > 0 && (
        <section className="border-b border-border/50 p-3">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <UserRound className="size-3.5" />
            Зі штату
          </h3>
          <div className="space-y-2">
            {groups.map((group) => {
              const missing = group.fields.every((f) => !presentTags.has(f.key))
              const selectedId = selected[group.id] ?? null
              return (
                <div key={group.id} className={missing ? "opacity-50" : undefined}>
                  <div className="flex items-center gap-1">
                    <PersonPicker
                      open={openPickerId === group.id}
                      onOpenChange={(open) => setOpenPickerId(open ? group.id : null)}
                      title={group.label}
                      triggerLabel={group.label}
                      items={pickerItems}
                      selectedId={selectedId}
                      onSelect={(personId) => void applyPerson(group, personId)}
                    />
                    {selectedId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Очистити групу"
                        onClick={() => clearGroup(group)}
                      >
                        <Eraser className="size-4" />
                      </Button>
                    )}
                  </div>
                  {missing && <p className="mt-1 text-xs text-muted-foreground">Полів немає в документі</p>}
                </div>
              )
            })}
          </div>
          {status && <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{status}</p>}
        </section>
      )}

      {simple.length > 0 && (
        <section className="p-3">
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">Поля документа</h3>
          <div className="space-y-2">
            {simple.map((field) => {
              const missing = !presentTags.has(field.key)
              return (
                <div key={field.key} className={missing ? "opacity-50" : undefined}>
                  <label className="mb-1 block truncate text-sm" title={field.label}>
                    {field.label}
                  </label>
                  <div className="flex items-center gap-1">
                    <Input
                      value={simpleValues[field.key] ?? ""}
                      onChange={(event) => setSimpleValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault()
                          fillSimple(field)
                        }
                      }}
                      placeholder={field.label}
                      className="h-8"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="Заповнити"
                      disabled={!(simpleValues[field.key] ?? "").trim() || missing}
                      onClick={() => fillSimple(field)}
                    >
                      <ArrowLeftRight className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="Скинути"
                      disabled={missing}
                      onClick={() => resetSimple(field)}
                    >
                      <Eraser className="size-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {groups.length === 0 && simple.length === 0 && (
        <p className="p-3 text-sm text-muted-foreground">У шаблона немає полів заповнення.</p>
      )}
    </aside>
  )
}
