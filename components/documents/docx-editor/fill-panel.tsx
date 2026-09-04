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

  // Картинка підпису живе поза контролом (якір у останньому абзаці), контрол поля
  // тримає назву, поки картинка на місці, і звільняється при її видаленні.
  // Ознака живого підписа — drawing за id у DOM. Він може з'явитись із
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

  // Плейсхолдерна поведінка текстових полів без читання вмісту: поле
  // «недоторкане», поки його вміст — лейбл із шаблона. Стан ведемо самі:
  // сіється один раз при завантаженні документа, знімається першим
  // редагуванням (change з активним полем) та панельним заповненням,
  // повертається reset/clear.
  const untouchedTags = React.useRef<Set<string>>(new Set())
  const seeded = React.useRef(false)
  const activeTagRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    seeded.current = false
    untouchedTags.current.clear()
  }, [editor])

  React.useEffect(() => {
    if (!editor || seeded.current) return
    const tags = [...presentTags].filter((tag) => {
      const field = fields.find((f) => f.key === tag)
      return field && field.type !== "signature"
    })
    if (tags.length === 0) return
    for (const tag of tags) untouchedTags.current.add(tag)
    seeded.current = true
  }, [editor, presentTags, fields])

  // Клік у «недоторкане» поле прибирає лейбл і ставить каретку всередину контрола
  // — перший друк одразу дані. Каретку адресує невидима мітка: 12 нуль-шириних
  // символів (U+2060/U+200B), біти хешу controlId — унікальна послідовність,
  // у абзаці зустрічається рівно один раз; невидима в прев'ю і в Word, стирається
  // панельним записом. Механіка з ери інлайн-вставок: search-анкор дає каретку
  // саме всередині SDT (DOM-виділення цим не володіє — движок трансує його на
  // рівень абзацу). Застосування після подвійного rAF: движок після кліку мовчки
  // повертає DOM-каретку; перед застосуванням стан перевіряється знову.
  React.useEffect(() => {
    if (!editor) return
    let scheduled = false
    const apply = async () => {
      scheduled = false
      if (bounceSuspend.active) return
      const snap = editor.snapshot()
      if (!snap.selectionCollapsed) return
      const tag = activeTagRef.current
      if (!tag || !untouchedTags.current.has(tag)) return
      const control = editor.query({ type: "contentControls", filter: { tag } })[0]
      if (!control) return
      const idNum = [...control.id].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 4096, 7)
      const marker = Array.from({ length: 12 }, (_, i) => ((idNum >> i) & 1 ? "\u200b" : "\u2060")).join("")
      if (!editor.surface?.contentControls.setValue(control.id, marker)) return
      let paraId: string | undefined
      for (let attempt = 0; attempt < 20 && !paraId; attempt++) {
        const found = editor.query({ type: "paragraphs" }).find((p) => p.paraId && p.text.includes(marker))
        paraId = found?.paraId
        if (!paraId) await new Promise((resolve) => setTimeout(resolve, 25))
      }
      if (!paraId) return
      editor.exec({ type: "setSelection", anchor: { paraId: paraId, search: marker } })
    }
    const onSelect = (snapshot: Parameters<Parameters<typeof editor.on<"selectionChange">>[1]>[0]) => {
      if (bounceSuspend.active) return
      const control = editor.query({ type: "contentControlAt" })
      activeTagRef.current = control?.tag ?? null
      if (!snapshot.selectionCollapsed || scheduled) return
      const tag = control?.tag
      if (!tag || !untouchedTags.current.has(tag)) return
      const field = fields.find((f) => f.key === tag)
      if (!field || field.type === "signature") return
      scheduled = true
      requestAnimationFrame(() => requestAnimationFrame(() => void apply()))
    }
    return editor.on("selectionChange", onSelect)
  }, [editor, fields])

  // Перше редагування активного поля знімає «недоторканість». Панельні записи
  // йдуть під bounceSuspend і цей слухач ігнорує, щоб не знімати стан помилково.
  React.useEffect(() => {
    if (!editor) return
    const onChange = () => {
      if (bounceSuspend.active) return
      const tag = activeTagRef.current
      if (tag && untouchedTags.current.has(tag)) untouchedTags.current.delete(tag)
    }
    return editor.on("change", onChange)
  }, [editor])

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
        // Повний розмір одразу: a:ext фігури серіалізується з розміру вставки
        // (resizeDrawing оновлює тільки wp:extent — Word рендерить за a:ext і
        // виходив вдвічі менший підпис). Каретка в останньому абзаці — комірка
        // не стискає вставку.
        widthPoints: Math.max(24, Math.round((normalized.widthPoints / normalized.heightPoints) * SIGNATURE_HEIGHT_PT)),
        heightPoints: SIGNATURE_HEIGHT_PT,
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
      // Актуальний id (wrap-конвертація може його змінити); зовнішній drawingId
      // лишається для прибирання у finally
      let currentId: string = drawingId

      // «Перед текстом» — окремий комміт ДО resize: конвертація inline → anchored
      // перезаписує внутрішній a:ext картинки, і resize в тому ж комміті втрачається
      // (в експорті Word рендерить за a:ext — виходив удвічі менший підпис).
      const wrapped = surface.applyDrawingOps([{ op: "setDrawingWrap", drawingNodeId: currentId, wrap: "inFront" }])
      if (!wrapped.committed) return false
      // Конвертація може змінити id вузла — перезнаходимо після wrap
      const freshId = [...document.querySelectorAll<HTMLElement>("[data-drawing-node-id]")]
        .map((el) => el.getAttribute("data-drawing-node-id") ?? "")
        .find((id) => !knownIds.has(id))
      if (freshId) {
        drawingId = freshId
        currentId = freshId
      }

      // Позиція «зліва від ПІБ». Горизонталь — сторінково (поля сторінки від
      // шрифтів не залежать, дрейфу немає). Вертикаль — від якірного абзацу
      // (останній абзац одразу під таблицею): відстань до рядка підпису залежить
      // лише від нижньої частини таблиці, а не від усього вмісту вище — дрейф
      // між рендерерами (шрифти редактора ≠ Times New Roman у Word) падає з
      // 5-10 мм до часток міліметра. Рендер може відсіяти від'ємний
      // paragraph-офсет — тоді fallback на сторінкову позицію (статус-кво).
      const pageXEmu = Math.max(0, Math.round((Math.min(...personLefts) - 4 - widthPx - pageRect.left) * 9525))
      const imageTopPx = sigRect.top + sigRect.height / 2 - heightPx / 2
      const pageYEmu = Math.max(0, Math.round((imageTopPx - pageRect.top) * 9525))

      // Верх якірного абзацу: останній [data-paragraph-id] у документі (порядок
      // DOM = порядок документа); абзац може мати кілька фрагментів — верх
      // берём мінімальний.
      let paragraphYEmu: number | null = null
      const paraEls = [...document.querySelectorAll<HTMLElement>("[data-paragraph-id]")]
      const lastParaEl = paraEls[paraEls.length - 1]
      if (lastParaEl) {
        const lastParaDomId = lastParaEl.getAttribute("data-paragraph-id")
        const anchorTop = Math.min(
          ...paraEls
            .filter((el) => el.getAttribute("data-paragraph-id") === lastParaDomId)
            .map((el) => el.getBoundingClientRect().top),
        )
        paragraphYEmu = Math.round((imageTopPx - anchorTop) * 9525)
      }

      const positionOnce = (verticalEmu: number, relativeToV: "page" | "paragraph") =>
        surface.applyDrawingOps([
          {
            op: "positionDrawing",
            drawingNodeId: currentId,
            position: { horizontalEmu: pageXEmu, relativeToH: "page", verticalEmu, relativeToV },
          },
        ])
      const refreshId = () => {
        const fresh = [...document.querySelectorAll<HTMLElement>("[data-drawing-node-id]")]
          .map((el) => el.getAttribute("data-drawing-node-id") ?? "")
          .find((id) => !knownIds.has(id))
        if (fresh) {
          drawingId = fresh
          currentId = fresh
        }
      }
      const confirmRendered = async () => {
        for (let attempt = 0; attempt < 5; attempt++) {
          if (document.querySelector(`[data-drawing-node-id="${currentId}"]:not(.docx-image-selection-overlay)`)) return true
          await new Promise((resolve) => setTimeout(resolve, 60))
        }
        return false
      }
      const tryPosition = async (verticalEmu: number, relativeToV: "page" | "paragraph", attempts: number) => {
        for (let attempt = 0; attempt < attempts; attempt++) {
          const applied = positionOnce(verticalEmu, relativeToV)
          refreshId()
          if (!applied.committed) {
            await new Promise((resolve) => setTimeout(resolve, 120))
            continue
          }
          // Закомітилось, але рендер відсіяв (кулювання) — міняємо базу одразу
          return await confirmRendered()
        }
        return false
      }

      let positioned = paragraphYEmu !== null ? await tryPosition(paragraphYEmu, "paragraph", 4) : false
      if (!positioned) positioned = await tryPosition(pageYEmu, "page", 6)
      if (!positioned) return false

      // Ховаємо назву поля («Підпис») — картинка її замінила
      surface.contentControls.setValue(controlId, "")
      sigMarkers.current.set(key, { drawingId: currentId })
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
    if (applied) {
      // Панельний запис не рахується редагуванням юзера: зміни під suspend,
      // щоб change-слухач не знімав «недоторканість» активного поля
      bounceSuspend.begin()
      try {
        for (const control of controls) {
          if (!editor.surface?.contentControls.setValue(control.id, value)) applied = false
        }
      } finally {
        bounceSuspend.end()
      }
    }
    // Плейсхолдерний стан: дані роблять поле «заповненим», лейбл/очистка — «недоторканим»
    const field = fields.find((f) => f.key === key)
    if (field && field.type !== "signature") {
      if (value && value !== field.label) untouchedTags.current.delete(key)
      else untouchedTags.current.add(key)
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
    // Скидання: усі поля повертаються до назв
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
