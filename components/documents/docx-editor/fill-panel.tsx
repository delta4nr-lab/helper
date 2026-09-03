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
  // Активні підписи: tag → id плаваючого drawing. Слухач change нижче повертає
  // назву полю, коли картинка підпису зникла.
  const sigMarkers = React.useRef<Map<string, { drawingId: string }>>(new Map())

  // Дефолтне значення поля — його назва. Коли користувач видаляє картинку підпису,
  // полю автоматично повертається назва — поле знову можна заповнити (хоч скільки
  // разів). Ознака живого підписа — drawing за id у DOM. Він може з'явитись із
  // запізненням на кілька кадрів після вставки, тому перед «смертю» підписа
  // коротко перепитуємо верстку.
  React.useEffect(() => {
    if (!editor) return
    let checkQueued = false
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    const drawingAlive = (drawingId: string) =>
      Boolean(document.querySelector(`[data-drawing-node-id="${drawingId}"]:not(.docx-image-selection-overlay)`))
    const verify = async (tag: string, info: { drawingId: string }) => {
      for (let attempt = 0; attempt < 6; attempt++) {
        if (bounceSuspend.active || sigMarkers.current.get(tag) !== info) return
        if (drawingAlive(info.drawingId)) return
        await sleep(80)
      }
      sigMarkers.current.delete(tag)
      const label = fields.find((f) => f.key === tag)?.label
      const controlId = editor.query({ type: "contentControls", filter: { tag } })[0]?.id
      if (label && controlId) editor.surface?.contentControls.setValue(controlId, label)
    }
    const check = () => {
      checkQueued = false
      if (bounceSuspend.active) return
      for (const [tag, info] of [...sigMarkers.current]) {
        void verify(tag, info)
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

  // Підпис: зображення з картки персоналії → плаваючий шар «перед текстом»
  // (фіксований розмір, не ростить рядок) зі сторінковою позицією «зліва від
  // ПІБ». Якір — останній абзац документа поза таблицею: рендер не малює
  // anchored-картинки, що виходять за межі комірки якоря. Контрол поля при цьому
  // НЕ чіпаємо структурно (тег/назва лишаються в DOCX): назва ховається на час
  // заповненості і повертається, коли картинку видалили (слухач change).
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
    let drawingId: string | null = null
    try {
      // Попередній плаваючий підпис поля прибираємо за id (без виділення)
      const previous = sigMarkers.current.get(key)
      sigMarkers.current.delete(key)
      if (previous) surface.deleteImage(previous.drawingId)

      const personKey = key.replace(/^signature/, "person")
      const heightEmu = Math.round(SIGNATURE_HEIGHT_PT * 12700)
      const widthEmu = Math.round((normalized.widthPoints / normalized.heightPoints) * heightEmu)
      const widthPx = widthEmu / 9525
      const heightPx = heightEmu / 9525

      // Геометрія полів ДО вставки: плаваюча картинка рядок не ростить, тож
      // вимірювання залишаються валідними і після wrap. Коротке опитування хромів.
      let pageRect: DOMRect | null = null
      let sigRect: DOMRect | null = null
      let personLefts: number[] = []
      for (let attempt = 0; attempt < 20 && !pageRect; attempt++) {
        const sigChrome = document.querySelector<HTMLElement>(`.docx-content-control-chrome[data-tag="${key}"]`)
        const personChrome = document.querySelector<HTMLElement>(`.docx-content-control-chrome[data-tag="${personKey}"]`)
        sigRect = sigChrome?.querySelector<HTMLElement>(".docx-content-control-boundary")?.getBoundingClientRect() ?? null
        personLefts = [...(personChrome?.querySelectorAll<HTMLElement>(".docx-content-control-boundary") ?? [])].map(
          (b) => b.getBoundingClientRect().left,
        )
        pageRect = (sigChrome?.closest(".docx-editor-page") ?? sigChrome?.closest("[class*='docx-page']"))?.getBoundingClientRect() ?? null
        if (!pageRect || !sigRect || personLefts.length === 0) {
          pageRect = null
          await new Promise((resolve) => setTimeout(resolve, 25))
        }
      }
      if (!pageRect || !sigRect || personLefts.length === 0) return false

      // Якір: останній абзац документа з w14:paraId (адресований; поза таблицею)
      const anchorParaId = [...editor.query({ type: "paragraphs" })].filter((p) => p.paraId).at(-1)?.paraId
      if (!anchorParaId) return false
      if (!editor.exec({ type: "setSelection", anchor: { paraId: anchorParaId } }).ok) return false

      // Знімок id наявних drawing — ДО мутацій: нова картинка може відрендеритись
      // синхронно, і пізніший знімок включив би її в «старі».
      const knownIds = new Set(
        [...document.querySelectorAll<HTMLElement>("[data-drawing-node-id]")].map((el) => el.getAttribute("data-drawing-node-id") ?? ""),
      )

      const result = await editor.executeImageCommand({
        type: "insertImage",
        data: normalized.bytes,
        mime: normalized.mime,
        // Мікро-розмір: проміжний inline-кадр, якщо він відрендериться, —
        // невидима крапка, а не картинка на новому рядку
        widthPoints: 2,
        heightPoints: 2,
      })
      if (!result.ok) return false

      // Id вставленого drawing: виділення або короткий DOM-диф (виділення
      // буває скинутим, якщо перед вставкою щось змінило модель)
      drawingId = editor.getSelectedImage()?.id ?? null
      for (let attempt = 0; attempt < 8 && !drawingId; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 25))
        drawingId =
          editor.getSelectedImage()?.id ??
          [...document.querySelectorAll<HTMLElement>("[data-drawing-node-id]")]
            .map((el) => el.getAttribute("data-drawing-node-id"))
            .find((id) => id && !knownIds.has(id)) ??
          null
      }
      if (!drawingId) return false

      // Один комміт: фіксований розмір + «перед текстом» + позиція «зліва від
      // ПІБ» — картинка з'являється одразу на місці. Конвертація inline →
      // anchored рідко змінює id вузла: тоді позиція відмовить, перезнайдемо
      // id і ретраїмо.
      const pageXEmu = Math.max(0, Math.round((Math.min(...personLefts) - 4 - widthPx - pageRect.left) * 9525))
      const pageYEmu = Math.max(0, Math.round((sigRect.top + sigRect.height / 2 - heightPx / 2 - pageRect.top) * 9525))
      let positioned = false
      for (let attempt = 0; attempt < 6 && !positioned; attempt++) {
        const applied = surface.applyDrawingOps([
          { op: "resizeDrawing", drawingNodeId: drawingId, extentEmu: { cx: widthEmu, cy: heightEmu } },
          { op: "setDrawingWrap", drawingNodeId: drawingId, wrap: "inFront" },
          {
            op: "positionDrawing",
            drawingNodeId: drawingId,
            position: { horizontalEmu: pageXEmu, relativeToH: "page", verticalEmu: pageYEmu, relativeToV: "page" },
          },
        ])
        positioned = applied.committed
        if (positioned) break
        const fresh = [...document.querySelectorAll<HTMLElement>("[data-drawing-node-id]")]
          .map((el) => el.getAttribute("data-drawing-node-id") ?? "")
          .find((id) => !knownIds.has(id))
        if (fresh) drawingId = fresh
        await new Promise((resolve) => setTimeout(resolve, 120))
      }
      if (!positioned) return false

      // Ховаємо назву поля («Підпис») — картинка її замінила
      surface.contentControls.setValue(controlId, "")
      sigMarkers.current.set(key, { drawingId })
      ok = true
      return true
    } finally {
      bounceSuspend.end()
      if (!ok) {
        // Невдале заповнення: прибираємо щойно вставлену картинку, назва повертається
        if (drawingId) surface.deleteImage(drawingId)
        surface.contentControls.setValue(controlId, label)
      }
    }
  }
  function setValueByTag(key: string, value: string): boolean {
    if (!editor) return false
    // Плаваюча картинка підпису живе поза контролом — при перезаписі вмісту
    // поля прибираємо її за id
    const previous = sigMarkers.current.get(key)
    if (previous) {
      editor.surface?.deleteImage(previous.drawingId)
      sigMarkers.current.delete(key)
    }
    const controls = editor.query({ type: "contentControls", filter: { tag: key } })
    let applied = controls.length > 0
    for (const control of controls) {
      if (!editor.surface?.contentControls.setValue(control.id, value)) applied = false
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
