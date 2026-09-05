"use client"

import * as React from "react"
import { normalizeImageBytes, useDocxEditor } from "@docx-editor.dev/react"
import { toast } from "sonner"
import {
  ArrowLeftRight,
  Eraser,
  UserRound,
  UserRoundSearch,
} from "lucide-react"

import {
  PersonPicker,
  type PersonPickerItem,
} from "@/components/documents/person-picker"
import { bounceSuspend } from "@/components/documents/docx-editor/bounce-suspend"
import {
  FIELD_CATALOGS,
  getNumberedFieldTitle,
  getStaffTag,
  parseStaffTag,
} from "@/components/documents/docx-editor/field-catalogs"
import type { EditorField, EditorPersonnel } from "@/components/documents/types"
import type { CourseRecordData } from "@/lib/courses/types"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { cn } from "@/lib/utils"

// Спеціальні типи полів, що заповнюються з картки персоналії.
const PERSON_FIELD_TYPES = new Set(["person", "position", "rank", "signature"])

// Висота підпису в документі, pt (≈ 4em при 14pt шрифті).
const SIGNATURE_HEIGHT_PT = 54

// Поля персоналу нової схеми тегів staff.{index}.{field}: назви — з довідника
// (без дублювання), перелік — для циклів заповнення/скидання групи.
const STAFF_FIELD_LABELS: Record<string, string> = Object.fromEntries(
  (FIELD_CATALOGS.find((catalog) => catalog.id === "personnel")?.fields ?? []).map(
    (field) => [field.id, field.label]
  )
)
const STAFF_FIELDS = ["fullName", "position", "rank", "signature"] as const

function fullName(person: EditorPersonnel): string {
  return [person.lastName, person.firstName, person.middleName]
    .filter(Boolean)
    .join(" ")
}

// Група спеціальних полів: спільний числовий суфікс (напр. position_1 / rank_1 /
// signature_1 / person_1) або окремий ключ без суфікса.
type PersonGroup = {
  id: string
  label: string
  fields: EditorField[]
}

function groupFields(fields: EditorField[]): {
  groups: PersonGroup[]
  simple: EditorField[]
} {
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
// Панель завжди змонтована: прихована лише візуально (open=false → hidden),
// бо refs (untouchedTags, sigMarkers) мусять жити між показами панелі.
export function FillPanel({
  fields,
  personnel,
  docVersion,
  open,
  courseRecords = [],
}: {
  fields: EditorField[]
  personnel: EditorPersonnel[]
  docVersion: number
  open: boolean
  courseRecords?: CourseRecordData[]
}) {
  const editor = useDocxEditor()

  const { groups: legacyGroups, simple } = React.useMemo(() => groupFields(fields), [fields])

  // Теги контролів, наявні у документі (для позначки «немає в документі»).
  // docVersion — свідомий тригер перерахунку при кожній зміні документа.
  const presentTags = React.useMemo(() => {
    if (!editor) return new Set<string>()
    return new Set(
      editor
        .query({ type: "contentControls" })
        .map((c) => c.tag ?? "")
        .filter(Boolean)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, docVersion])

  // Групи полів персоналу нової схеми (tag = staff.{index}.{field}): розбір
  // тегів контролів документа → групування за індексом людини. Відсутні в
  // документі поля просто не потрапляють у групу.
  const staffGroups = React.useMemo(() => {
    const byIndex = new Map<number, Record<string, string>>()
    for (const tag of presentTags) {
      const parsed = parseStaffTag(tag)
      if (!parsed) continue
      let tags = byIndex.get(parsed.index)
      if (!tags) {
        tags = {}
        byIndex.set(parsed.index, tags)
      }
      tags[parsed.field] = tag
    }
    return [...byIndex.entries()]
      .sort(([a], [b]) => a - b)
      .map(([index, tags]) => ({ index, tags }))
  }, [presentTags])

  // Віртуальні групи для hover-quickPick нових чіпів (course:*/staff:*):
  // у aside НЕ рендеряться, живуть тільки для personGroupAt + quickPick.
  const hasKursantChips = React.useMemo(
    () => [...presentTags].some((tag) => tag.startsWith("course:")),
    [presentTags]
  )
  const hasStaffChips = React.useMemo(
    () => [...presentTags].some((tag) => tag.startsWith("staff:")),
    [presentTags]
  )
  const groups = React.useMemo(() => {
    const list = [...legacyGroups]
    if (hasKursantChips) list.push({ id: "course-fill", label: "Курсант (чіп)", fields: [] })
    if (hasStaffChips) list.push({ id: "staff-fill", label: "ПІБ (персонал)", fields: [] })
    return list
  }, [legacyGroups, hasKursantChips, hasStaffChips])

  const [openPickerId, setOpenPickerId] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<Record<string, string>>({})
  // Обрані особи для груп staff.{index}.* (ключ — індекс людини)
  const [staffSelected, setStaffSelected] = React.useState<Record<number, string>>({})
  const [simpleValues, setSimpleValues] = React.useState<
    Record<string, string>
  >({})
  // Активні підписи: tag → { drawingId, anchorParaId } — абзац-якір потрібен,
  // щоб наступні підписи не вставлялись у той самий абзац (каретка там
  // резолвиться у ран drawing, і рушій відмовляє другу вставку). Слухач change
  // нижче повертає назву полю, коли картинка підпису зникла.
  const sigMarkers = React.useRef<
    Map<string, { drawingId: string; anchorParaId: string }>
  >(new Map())

  // Картинка підпису живе поза контролом (якір у останньому абзаці), контрол поля
  // тримає назву, поки картинка на місці, і звільняється при її видаленні.
  // Ознака живого підписа — drawing за id у DOM. Він може з'явитись із
  // запізненням на кілька кадрів після вставки, тому перед «смертю» підписа
  // коротко перепитуємо верстку.
  React.useEffect(() => {
    if (!editor) return
    let checkQueued = false
    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms))
    const drawingAlive = (drawingId: string) =>
      Boolean(
        document.querySelector(
          `[data-drawing-node-id="${drawingId}"]:not(.docx-image-selection-overlay)`
        )
      )
    const verify = async (tag: string, info: { drawingId: string }) => {
      for (let attempt = 0; attempt < 6; attempt++) {
        if (bounceSuspend.active || sigMarkers.current.get(tag) !== info) return
        if (drawingAlive(info.drawingId)) return
        await sleep(80)
      }
      sigMarkers.current.delete(tag)
      // Підпис видалено з документа: слово «Підпис» ховаємо (порожній контрол),
      // щоб воно не потрапляло на друк/експорт. Контрол лишається в DOCX —
      // повторний вибір людини з підписом знову заповнить поле.
      const controlId = editor.query({
        type: "contentControls",
        filter: { tag },
      })[0]?.id
      if (controlId) editor.surface?.contentControls.setValue(controlId, "")
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
      const control = editor.query({
        type: "contentControls",
        filter: { tag },
      })[0]
      if (!control) return
      const idNum = [...control.id].reduce(
        (acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 4096,
        7
      )
      const marker = Array.from({ length: 12 }, (_, i) =>
        (idNum >> i) & 1 ? "\u200b" : "\u2060"
      ).join("")
      if (!editor.surface?.contentControls.setValue(control.id, marker)) return
      let paraId: string | undefined
      for (let attempt = 0; attempt < 20 && !paraId; attempt++) {
        const found = editor
          .query({ type: "paragraphs" })
          .find((p) => p.paraId && p.text.includes(marker))
        paraId = found?.paraId
        if (!paraId) await new Promise((resolve) => setTimeout(resolve, 25))
      }
      if (!paraId) return
      editor.exec({
        type: "setSelection",
        anchor: { paraId: paraId, search: marker },
      })
    }
    const onSelect = (
      snapshot: Parameters<
        Parameters<typeof editor.on<"selectionChange">>[1]
      >[0]
    ) => {
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
      if (tag && untouchedTags.current.has(tag))
        untouchedTags.current.delete(tag)
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

  // Швидкий вибір особи з курсантського реєстру: ті дані з активного курсу —
  // заповнює всі чіпи course:* у документі за одне підтикування
  const kursantPickerItems: PersonPickerItem[] = React.useMemo(
    () =>
      courseRecords.map((r) => ({
        id: r.id,
        name: r.fullName ?? `${r.lastName} ${r.firstName}`.trim(),
        position: r.position ?? "",
        rank: r.rank ?? "",
      })),
    [courseRecords]
  )

  // Швидкий вибір особи: ховер над полем ПІБ у документі → компактна кругла
  // кнопка праворуч від рамки → список зі штату → applyPerson заповнює всю
  // групу (ПІБ, посада, звання, підпис). Клік у поле лишається звичайним
  // редагуванням. Приховування з затримкою 200 мс — курсор встигає дійти до
  // кнопки; відкритий список тримає кнопку.
  const [quickPick, setQuickPick] = React.useState<{
    group: PersonGroup | null
    staffIndex: number | null
    tag: string
    left: number
    top: number
  } | null>(null)
  const [quickPickOpen, setQuickPickOpen] = React.useState(false)
  const hideTimer = React.useRef<number | null>(null)

  const clearHideTimer = React.useCallback(() => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }, [])
  const scheduleHide = React.useCallback(() => {
    clearHideTimer()
    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = null
      setQuickPick((prev) => (prev && !quickPickOpen ? null : prev))
    }, 200)
  }, [quickPickOpen, clearHideTimer])

  React.useEffect(() => {
    if (!editor) return
    // Хром поля — оверлей (рани йому не належать), тому детекція геометрична:
    // курсор усередині boundary-ректу поля.
    const personGroupAt = (x: number, y: number) => {
      for (const field of fields) {
        if (field.type !== "person") continue
        const boundary = document.querySelector<HTMLElement>(
          `.docx-content-control-chrome[data-tag="${field.key}"] .docx-content-control-boundary`
        )
        const rect = boundary?.getBoundingClientRect()
        if (!rect || rect.width === 0) continue
        if (
          x >= rect.left &&
          x <= rect.right &&
          y >= rect.top &&
          y <= rect.bottom
        ) {
          return {
            group:
              groups.find((g) => g.fields.some((f) => f.key === field.key)) ??
              null,
            staffIndex: null,
            tag: field.key,
          }
        }
      }
      // Курсантські чіпи (tag = course:<колонка>): boundary з data-tag префіксом
      const courseBoundary = document.querySelector<HTMLElement>(
        '.docx-content-control-chrome[data-tag^="course:"] .docx-content-control-boundary'
      )
      if (courseBoundary) {
        const rect = courseBoundary.getBoundingClientRect()
        if (
          rect.width > 0 &&
          x >= rect.left &&
          x <= rect.right &&
          y >= rect.top &&
          y <= rect.bottom
        ) {
          const courseGroup = groups.find((g) => g.id === "course-fill")
          if (courseGroup) return { group: courseGroup, staffIndex: null, tag: "course:" }
        }
      }
      // Персональні чіпи (tag = staff:<роль>)
      const staffBoundary = document.querySelector<HTMLElement>(
        '.docx-content-control-chrome[data-tag^="staff:"] .docx-content-control-boundary'
      )
      if (staffBoundary) {
        const rect = staffBoundary.getBoundingClientRect()
        if (
          rect.width > 0 &&
          x >= rect.left &&
          x <= rect.right &&
          y >= rect.top &&
          y <= rect.bottom
        ) {
          const staffGroup = groups.find((g) => g.id === "staff-fill")
          if (staffGroup) return { group: staffGroup, staffIndex: null, tag: "staff:" }
        }
      }
      // Поля персоналу нової схеми (tag = staff.{index}.{field}): наведення на
      // будь-яке поле людини відкриває швидкий вибір для її групи
      for (const group of staffGroups) {
        for (const tag of Object.values(group.tags)) {
          const boundary = document.querySelector<HTMLElement>(
            `.docx-content-control-chrome[data-tag="${tag}"] .docx-content-control-boundary`
          )
          const rect = boundary?.getBoundingClientRect()
          if (!rect || rect.width === 0) continue
          if (
            x >= rect.left &&
            x <= rect.right &&
            y >= rect.top &&
            y <= rect.bottom
          ) {
            return { group: null, staffIndex: group.index, tag }
          }
        }
      }
      return null
    }
    const onPointerOver = (event: PointerEvent) => {
      if (bounceSuspend.active) return
      // Поки список вибору відкритий — hover по документу ігнорується:
      // вікно не стрибає на інші поля і не ховається
      if (quickPickOpen) return
      const found = personGroupAt(event.clientX, event.clientY)
      if (!found || !found.tag) return
      clearHideTimer()
      const isPrefixTag = found.tag === "course:" || found.tag === "staff:"
      const rect = document
        .querySelector<HTMLElement>(
          isPrefixTag
            ? `.docx-content-control-chrome[data-tag^="${found.tag}"] .docx-content-control-boundary`
            : `.docx-content-control-chrome[data-tag="${found.tag}"] .docx-content-control-boundary`
        )
        ?.getBoundingClientRect()
      if (!rect || rect.width === 0) return
      const sameGroup =
        (prev: typeof quickPick) =>
        (prev?.staffIndex ?? null) === found.staffIndex &&
        (prev?.group?.id ?? null) === (found.group?.id ?? null)
      setQuickPick((prev) =>
        sameGroup(prev)
          ? prev
          : {
              group: found.group,
              staffIndex: found.staffIndex,
              tag: found.tag,
              left: rect.right + 6,
              top: rect.top,
            }
      )
    }
    const onPointerOut = (event: PointerEvent) => {
      if (quickPickOpen) return
      if (!personGroupAt(event.clientX, event.clientY)) return
      scheduleHide()
    }
    document.addEventListener("pointerover", onPointerOver, true)
    document.addEventListener("pointerout", onPointerOut, true)
    return () => {
      document.removeEventListener("pointerover", onPointerOver, true)
      document.removeEventListener("pointerout", onPointerOut, true)
      clearHideTimer()
    }
  }, [editor, fields, groups, staffGroups, quickPickOpen, scheduleHide, clearHideTimer])

  React.useEffect(() => {
    if (!quickPick) return
    const viewport = document.querySelector<HTMLElement>(
      ".docx-editor-one-surface__viewport"
    )
    const reposition = () => {
      const tag =
        quickPick.tag ||
        quickPick.group?.fields.find((f) => f.type === "person")?.key
      if (!tag) return
      const isPrefixTag = tag === "course:" || tag === "staff:"
      const rect = document
        .querySelector<HTMLElement>(
          isPrefixTag
            ? `.docx-content-control-chrome[data-tag^="${tag}"] .docx-content-control-boundary`
            : `.docx-content-control-chrome[data-tag="${tag}"] .docx-content-control-boundary`
        )
        ?.getBoundingClientRect()
      if (!rect) {
        setQuickPick(null)
        return
      }
      setQuickPick((prev) =>
        prev ? { ...prev, left: rect.right + 6, top: rect.top } : null
      )
    }
    viewport?.addEventListener("scroll", reposition, { passive: true })
    return () => viewport?.removeEventListener("scroll", reposition)
  }, [quickPick])

  // Підпис: зображення з картки персоналії → плаваючий шар «перед текстом»
  // (фіксований розмір, не ростить рядок) зі сторінковою позицією «зліва від
  // ПІБ». Якор — абзац САМОГО поля підпису (chrome → closest абзац: гарантовано
  // матеріалізований у paint-шарі), вставка через surface-lane з явним
  // paragraphId/offset — у кінець абзаца, ПОСЛЕ SDT (поза контролем). Для
  // полів усередині таблиці — старий caret-шлях (якор поза таблицею). Контрол
  // поля структурно НЕ чіпаємо (тег/назва лишаються в DOCX): назва ховається
  // на час заповненості і повертається, коли картинку видалили (слухач change).
  async function fillSignature(
    key: string,
    person: EditorPersonnel
  ): Promise<boolean> {
    if (!editor) return false
    const surface = editor.surface
    if (!person.signaturePath || !surface) return false
    const controlId = editor.query({
      type: "contentControls",
      filter: { tag: key },
    })[0]?.id
    if (!controlId) return false

    // Абзац-якор: лише МАТЕРІАЛІЗОВАНІ абзаци. Paint-віртуалізація малює
    // сторінки біля viewport'а — anchored-картинка з якорем на
    // невітертуалізованій сторінці не малюється взагалі (drawingAny: false).
    // Сторінка поля підпису гарантовано матеріалізована (хром там), тож
    // кандидати — абзаци САМОЇ СТОРІНКИ поля: painted-DOM сторінки → текст
    // → модельний paraId. Порядок DOM = порядок документа.
    const paragraphs = [...editor.query({ type: "paragraphs" })]
    const sigChrome = document.querySelector<HTMLElement>(
      `.docx-content-control-chrome[data-tag="${key}"]`
    )
    const pageEl =
      sigChrome?.closest<HTMLElement>(".docx-editor-page") ??
      sigChrome?.closest<HTMLElement>("[class*='docx-page']")
    const byText = new Map<string, string[]>()
    for (const p of paragraphs) {
      if (!p.paraId) continue
      const normalizedText = p.text.trim()
      if (!normalizedText) continue
      const list = byText.get(normalizedText) ?? []
      list.push(p.paraId)
      byText.set(normalizedText, list)
    }
    const pageCandidates: string[] = []
    if (pageEl) {
      for (const el of pageEl.querySelectorAll<HTMLElement>("[data-paragraph-id]")) {
        const text = (el.textContent ?? "").trim()
        if (!text) continue
        for (const paraId of byText.get(text) ?? []) pageCandidates.push(paraId)
      }
    }
    let anchorParaId: string | null = null

    const response = await fetch(person.signaturePath)
    if (!response.ok) return false
    const normalized = normalizeImageBytes(
      new Uint8Array(await response.arrayBuffer())
    )
    if (!normalized.ok) return false

    bounceSuspend.begin()
    let ok = false
    let drawingId: string | null = null
    let currentId = ""
    try {
      // Попередній плаваючий підпис поля прибираємо за id (без виділення)
      const previous = sigMarkers.current.get(key)
      sigMarkers.current.delete(key)
      if (previous) surface.deleteImage(previous.drawingId)
      // Порожній контрол (слово «Підпис» приховано) дає нестабільну геометрію
      // хрому — тимчасовий пробіл гарантує вимірювання; успішний фінал і шлях
      // невдачі в будь-якому разі повертають контрол до порожнього стану
      surface.contentControls.setValue(controlId, " ")

      // Поле ПІБ групи для позиції «зліва від ПІБ»: нова схема
      // staff.{i}.signature → staff.{i}.fullName; legacy — signature → person.
      const parsedStaff = parseStaffTag(key)
      const personKey = parsedStaff
        ? getStaffTag(parsedStaff.index, "fullName")
        : key.replace(/^signature/, "person")
      const heightEmu = Math.round(SIGNATURE_HEIGHT_PT * 12700)
      const widthEmu = Math.round(
        (normalized.widthPoints / normalized.heightPoints) * heightEmu
      )
      const widthPx = widthEmu / 9525
      const heightPx = heightEmu / 9525

      // Геометрія полів ДО вставки: плаваюча картинка рядок не ростить, тож
      // вимірювання залишаються валідними і після wrap. Коротке опитування хромів.
      let pageRect: DOMRect | null = null
      let sigRect: DOMRect | null = null
      let personLefts: number[] = []
      for (let attempt = 0; attempt < 20 && !pageRect; attempt++) {
        const sigChrome = document.querySelector<HTMLElement>(
          `.docx-content-control-chrome[data-tag="${key}"]`
        )
        const personChrome = document.querySelector<HTMLElement>(
          `.docx-content-control-chrome[data-tag="${personKey}"]`
        )
        sigRect =
          sigChrome
            ?.querySelector<HTMLElement>(".docx-content-control-boundary")
            ?.getBoundingClientRect() ?? null
        const personLeftsRaw = [
          ...(personChrome?.querySelectorAll<HTMLElement>(
            ".docx-content-control-boundary"
          ) ?? []),
        ].map((b) => b.getBoundingClientRect().left)
        // Fallback: без ПІБ-поля групи — позиція зліва від самого поля підпису
        personLefts = personLeftsRaw.length > 0 ? personLeftsRaw : sigRect ? [sigRect.left] : []
        pageRect =
          (
            sigChrome?.closest(".docx-editor-page") ??
            sigChrome?.closest("[class*='docx-page']")
          )?.getBoundingClientRect() ?? null
        if (!pageRect || !sigRect || personLefts.length === 0) {
          pageRect = null
          await new Promise((resolve) => setTimeout(resolve, 25))
        }
      }
      if (!pageRect || !sigRect || personLefts.length === 0) return false

      // Якор: матеріалізовані абзаци сторінки поля підпису (з кінця назад,
      // скіпаючи вже зайняті підписами — каретка в них резолвиться у ран
      // drawing і рушій відмовляє вставку). Тест — каретка поза контролем.
      const takenAnchors = new Set(
        [...sigMarkers.current.values()].map((info) => info.anchorParaId)
      )
      for (let i = pageCandidates.length - 1; i >= 0; i--) {
        const candidate = pageCandidates[i]
        if (takenAnchors.has(candidate)) continue
        if (!editor.exec({ type: "setSelection", anchor: { paraId: candidate } }).ok)
          continue
        if (!editor.query({ type: "contentControlAt" })) {
          anchorParaId = candidate
          break
        }
      }
      if (!anchorParaId) {
        // Фолбек: глобальний walk по всіх модельних абзацах (табличний
        // випадок: на сторінці поля чистих абзаців може не бути)
        for (let i = paragraphs.length - 1; i >= 0; i--) {
          const candidate = paragraphs[i].paraId
          if (!candidate || takenAnchors.has(candidate)) continue
          if (!editor.exec({ type: "setSelection", anchor: { paraId: candidate } }).ok)
            continue
          if (!editor.query({ type: "contentControlAt" })) {
            anchorParaId = candidate
            break
          }
        }
      }
      if (!anchorParaId) return false

      // Знімок id наявних drawing — ДО вставки (для пошуку нової у DOM-дифі)
      const knownIdsPre = new Set(
        [
          ...document.querySelectorAll<HTMLElement>("[data-drawing-node-id]"),
        ].map((el) => el.getAttribute("data-drawing-node-id") ?? "")
      )
      // Вставка з повторами: одразу після видалення попереднього підписа рушій
      // може відмовити першу спробу (незавершений коміт видалення) — коротка
      // пауза і повтор дають стабільний результат
      const insertCommand = {
        type: "insertImage" as const,
        data: normalized.bytes,
        mime: normalized.mime,
        // Повний розмір одразу: a:ext фігури серіалізується з розміру вставки
        // (resizeDrawing оновлює тільки wp:extent — Word рендерить за a:ext і
        // виходив вдвічі менший підпис).
        widthPoints: Math.max(
          24,
          Math.round(
            (normalized.widthPoints / normalized.heightPoints) *
              SIGNATURE_HEIGHT_PT
          ),
        ),
        heightPoints: SIGNATURE_HEIGHT_PT,
      }
      let result = await editor.executeImageCommand(insertCommand)
      for (let attempt = 0; !result.ok && attempt < 2; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 120))
        result = await editor.executeImageCommand(insertCommand)
      }
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
            .find((id) => id && !knownIdsPre.has(id)) ??
          null
      }
      if (!drawingId) return false
      currentId = drawingId

      if (!currentId || !anchorParaId) return false
      // id наявних drawing КРІМ нашої: після wrap конвертація може змінити
      // id вузла — новий id шукаємо серед «не відомих»
      const knownIds = new Set(
        [...document.querySelectorAll<HTMLElement>("[data-drawing-node-id]")]
          .map((el) => el.getAttribute("data-drawing-node-id") ?? "")
          .filter((id) => id !== currentId)
      )

      // «Перед текстом» — окремий комміт ДО resize: конвертація inline → anchored
      // перезаписує внутрішній a:ext картинки, і resize в тому ж комміті втрачається
      // (в експорті Word рендерить за a:ext — виходив удвічі менший підпис).
      const wrapped = surface.applyDrawingOps([
        { op: "setDrawingWrap", drawingNodeId: currentId, wrap: "inFront" },
      ])
      if (!wrapped.committed || wrapped.rejected) return false
      // Конвертація може змінити id вузла — перезнаходимо після wrap
      const freshId = [
        ...document.querySelectorAll<HTMLElement>("[data-drawing-node-id]"),
      ]
        .map((el) => el.getAttribute("data-drawing-node-id") ?? "")
        .find((id) => !knownIds.has(id))
      if (freshId) {
        drawingId = freshId
        currentId = freshId
      }

      // Позиція «зліва від ПІБ». Горизонталь — завжди сторінково (поля сторінки
      // від шрифтів не залежать). Вертикаль: сторінкова база — ОСНОВНА
      // (однозначна система координат, не залежить від відстані до якоря),
      // paragraph-фолбек другим (точніша вертикаль в експорті Word).
      const pageXEmu = Math.max(
        0,
        Math.round(
          (Math.min(...personLefts) - 4 - widthPx - pageRect.left) * 9525
        )
      )
      const imageTopPx = sigRect.top + sigRect.height / 2 - heightPx / 2
      const pageYEmu = Math.max(
        0,
        Math.round((imageTopPx - pageRect.top) * 9525)
      )

      // Верх якірного абзацу: DOM-фрагменти ОБРАНОГО якоря (порядок DOM =
      // порядок документа); абзац може мати кілька фрагментів — верх берём
      // мінімальний.
      let paragraphYEmu: number | null = null
      const paraEls = [
        ...document.querySelectorAll<HTMLElement>("[data-paragraph-id]"),
      ]
      const anchorTops = paraEls
        .filter(
          (el) => el.getAttribute("data-paragraph-id") === anchorParaId
        )
        .map((el) => el.getBoundingClientRect().top)
      if (anchorTops.length > 0) {
        const anchorTop = Math.min(...anchorTops)
        paragraphYEmu = Math.round((imageTopPx - anchorTop) * 9525)
      }

      const positionOnce = (
        verticalEmu: number,
        relativeToV: "page" | "paragraph"
      ) =>
        surface.applyDrawingOps([
          {
            op: "positionDrawing",
            drawingNodeId: currentId,
            position: {
              horizontalEmu: pageXEmu,
              relativeToH: "page",
              verticalEmu,
              relativeToV,
            },
          },
        ])
      const refreshId = () => {
        const fresh = [
          ...document.querySelectorAll<HTMLElement>("[data-drawing-node-id]"),
        ]
          .map((el) => el.getAttribute("data-drawing-node-id") ?? "")
          .find((id) => !knownIds.has(id))
        if (fresh) {
          drawingId = fresh
          currentId = fresh
        }
      }
      const confirmRendered = async () => {
        for (let attempt = 0; attempt < 5; attempt++) {
          if (
            document.querySelector(
              `[data-drawing-node-id="${currentId}"]:not(.docx-image-selection-overlay)`
            )
          )
            return true
          await new Promise((resolve) => setTimeout(resolve, 60))
        }
        return false
      }
      const tryPosition = async (
        verticalEmu: number,
        relativeToV: "page" | "paragraph",
        attempts: number
      ) => {
        for (let attempt = 0; attempt < attempts; attempt++) {
          const applied = positionOnce(verticalEmu, relativeToV)
          refreshId()
          if (!applied.committed || applied.rejected) {
            await new Promise((resolve) => setTimeout(resolve, 250))
            continue
          }
          if (await confirmRendered()) return true
        }
        return false
      }

      let positioned = await tryPosition(pageYEmu, "page", 6)
      if (!positioned && paragraphYEmu !== null) {
        positioned = await tryPosition(paragraphYEmu, "paragraph", 4)
      }
      if (!positioned) return false

      // Ховаємо назву поля («Підпис») — картинка її замінила
      surface.contentControls.setValue(controlId, "")
      sigMarkers.current.set(key, { drawingId: currentId, anchorParaId })
      ok = true
      return true
    } finally {
      bounceSuspend.end()
      if (!ok) {
        // Невдале заповнення: прибираємо щойно вставлену картинку; слово «Підпис»
        // не повертаємо — контрол лишається порожнім (чистий друк/експорт)
        if (drawingId) surface.deleteImage(drawingId)
        surface.contentControls.setValue(controlId, "")
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
    const controls = editor.query({
      type: "contentControls",
      filter: { tag: key },
    })
    let applied = controls.length > 0
    if (applied) {
      // Панельний запис не рахується редагуванням юзера: зміни під suspend,
      // щоб change-слухач не знімав «недоторканість» активного поля
      bounceSuspend.begin()
      try {
        for (const control of controls) {
          if (!editor.surface?.contentControls.setValue(control.id, value))
            applied = false
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

  // Вибір співробітника для групи staff.{index}.*: текстові поля — setValueByTag
  // (усі контроли тега), підпис — плаваюча картинка «перед текстом» через
  // fillSignature. Відсутні в документі поля просто пропускаються.
  async function applyStaffGroup(index: number, personId: string) {
    const person = personnel.find((p) => p.id === personId)
    if (!person || !editor) return
    setStaffSelected((prev) => ({ ...prev, [index]: personId }))
    setOpenPickerId(null)
    let signatureMissing = false
    let signatureFailed = false
    let filled = 0
    for (const field of STAFF_FIELDS) {
      const tag = getStaffTag(index, field)
      const control = editor.query({
        type: "contentControls",
        filter: { tag },
      })[0]
      if (!control) continue
      if (field === "signature") {
        if (!person.signaturePath) {
          signatureMissing = true
          // Людина без підписа: прибираємо підпис попередньої людини (якщо був)
          // і ховаємо слово «Підпис», щоб воно не потрапляло на друк
          setValueByTag(tag, "")
          continue
        }
        if (await fillSignature(tag, person)) filled++
        else signatureFailed = true
        continue
      }
      const value =
        field === "fullName"
          ? fullName(person)
          : field === "position"
            ? person.position
            : person.rank
      if (setValueByTag(tag, value)) filled++
    }
    if (signatureMissing)
      toast.warning(`У ${fullName(person)} немає підпису в картці персоналії`)
    else if (signatureFailed)
      toast.warning(`Не вдалося вставити підпис ${fullName(person)}`)
    else if (filled > 0)
      toast.success(`Заповнено поля людини №${index}: ${fullName(person)}.`)
  }

  // Скидання групи staff.{index}.*: текстові поля повертаються до назв
  // («ПІБ (1)»), підпис — картинка видаляється, контрол очищується.
  function resetStaffGroup(index: number) {
    setStaffSelected((prev) => {
      const next = { ...prev }
      delete next[index]
      return next
    })
    for (const field of STAFF_FIELDS) {
      const tag = getStaffTag(index, field)
      const value =
        field === "signature"
          ? ""
          : getNumberedFieldTitle(STAFF_FIELD_LABELS[field] ?? field, index)
      setValueByTag(tag, value)
    }
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
          // Людина без підписа: прибираємо підпис попередньої людини (якщо був)
          // і ховаємо слово «Підпис», щоб воно не потрапляло на друк
          setValueByTag(field.key, "")
          continue
        }
        if (!(await fillSignature(field.key, person))) signatureFailed = true
      }
    }
    if (signatureMissing)
      toast.warning(`У ${fullName(person)} немає підпису в картці персоналії`)
    else if (signatureFailed)
      toast.warning(`Не вдалося вставити підпис ${fullName(person)}`)
  }

  // Заповнення всіх course:* чіпів даними одного курсанта з активного курсу.
  // Чіпи розблоковані (без payload) — setValue приймається.
  function fillKursantChips(record: CourseRecordData) {
    if (!editor) return
    const columns = record as unknown as Record<string, string | null>
    const controls = editor.query({ type: "contentControls" })
    let filled = 0
    for (const control of controls) {
      const tag = control.tag ?? ""
      if (!tag.startsWith("course:")) continue
      const column = tag.slice("course:".length)
      if (!column) continue
      const value = columns[column] ?? ""
      if (editor.surface?.contentControls.setValue(control.id, value)) filled++
    }
    toast.success(
      filled > 0 ? `Заповнено ${filled} поле(ів) курсанта.` : "Полів course:* не знайдено."
    )
  }

  // Заповнення всіх staff:* чіпів даними однієї людини зі штату.
  async function fillStaffChips(person: EditorPersonnel) {
    if (!editor) return
    const controls = editor.query({ type: "contentControls" })
    let filled = 0
    for (const control of controls) {
      const tag = control.tag ?? ""
      if (!tag.startsWith("staff:")) continue
      const role = tag.slice("staff:".length)
      if (role === "signature") {
        if (await fillSignature(tag, person)) filled++
        continue
      }
      const value =
        role === "position"
          ? person.position
          : role === "rank"
            ? person.rank
            : fullName(person)
      if (editor.surface?.contentControls.setValue(control.id, value)) filled++
    }
    toast.success(
      filled > 0
        ? `Заповнено персональні чіпи: ${fullName(person)} (${filled}).`
        : "Персональних чіпів не знайдено."
    )
  }

  // Скидання групи: setValue перезаписує вміст контролів, включно з картинкою
  // підпису всередині них.
  function clearGroup(group: PersonGroup) {    setSelected((prev) => {
      const next = { ...prev }
      delete next[group.id]
      return next
    })
    // Скидання: текстові поля повертаються до назв, слово «Підпис» ховається —
    // порожній контрол не потрапляє на друк до вибору людини з підписом
    for (const field of group.fields) {
      setValueByTag(field.key, field.type === "signature" ? "" : field.label)
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
    <>
      {quickPick && (
        <div
          className="fixed z-50"
          style={{
            left: quickPick.left,
            top: quickPick.top,
            transform: "translateY(-50%)",
          }}
          onPointerEnter={clearHideTimer}
          onPointerLeave={scheduleHide}
        >
          <PersonPicker
            compact
            open={quickPickOpen}
            onOpenChange={setQuickPickOpen}
            title={
              quickPick.staffIndex !== null
                ? `Обрати співробітника для людини №${quickPick.staffIndex}`
                : quickPick.group?.id === "course-fill"
                  ? "Курсанти з активного курсу"
                  : "Обрати особу зі штату"
            }
            icon={<UserRoundSearch className="size-4" />}
            triggerLabel={
              quickPick.group?.id === "course-fill" ? "З курсу" : "Зі штату"
            }
            items={
              quickPick.group?.id === "course-fill"
                ? kursantPickerItems
                : pickerItems
            }
            selectedId={
              quickPick.staffIndex !== null
                ? (staffSelected[quickPick.staffIndex] ?? null)
                : quickPick.group?.id
                  ? (selected[quickPick.group.id] ?? null)
                  : null
            }
            onSelect={(selectedId) => {
              if (quickPick.staffIndex !== null) {
                void applyStaffGroup(quickPick.staffIndex, selectedId)
              } else if (quickPick.group?.id === "course-fill") {
                const record = courseRecords.find(
                  (item) => item.id === selectedId
                )
                if (record) fillKursantChips(record)
              } else if (quickPick.group?.id === "staff-fill") {
                const person = personnel.find((item) => item.id === selectedId)
                if (person) void fillStaffChips(person)
              } else if (quickPick.group) {
                void applyPerson(quickPick.group, selectedId)
              }
              setQuickPickOpen(false)
              clearHideTimer()
              setQuickPick(null)
            }}
          />
        </div>
      )}
      <aside
        className={cn(
          "flex h-full w-72 shrink-0 flex-col overflow-y-auto border-l border-border/50 bg-background",
          !open && "hidden"
        )}
      >
        <div className="border-b border-border/50 px-3 py-2 text-sm font-semibold">
          Заповнення
        </div>

        {staffGroups.length > 0 && (
          <section className="border-b border-border/50 p-3">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <UserRound className="size-3.5" />
              Персонал
            </h3>
            <div className="space-y-2">
              {staffGroups.map((group) => {
                const selectedId = staffSelected[group.index] ?? null
                const selectedPerson = personnel.find(
                  (p) => p.id === selectedId
                )
                return (
                  <div key={group.index} className="flex items-center gap-1">
                    <PersonPicker
                      open={openPickerId === `staff-${group.index}`}
                      onOpenChange={(open) =>
                        setOpenPickerId(open ? `staff-${group.index}` : null)
                      }
                      title={`Людина №${group.index}`}
                      triggerLabel={
                        selectedPerson ? fullName(selectedPerson) : `Людина №${group.index}`
                      }
                      items={pickerItems}
                      selectedId={selectedId}
                      onSelect={(personId) =>
                        void applyStaffGroup(group.index, personId)
                      }
                    />
                    {selectedId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Очистити групу"
                        onClick={() => resetStaffGroup(group.index)}
                      >
                        <Eraser className="size-4" />
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {groups.length > 0 && (
          <section className="border-b border-border/50 p-3">
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <UserRound className="size-3.5" />
              Зі штату
            </h3>
            <div className="space-y-2">
              {groups
                .filter((group) => group.id !== "course-fill" && group.id !== "staff-fill")
                .map((group) => {
                const missing = group.fields.every(
                  (f) => !presentTags.has(f.key)
                )
                const selectedId = selected[group.id] ?? null
                return (
                  <div
                    key={group.id}
                    className={missing ? "opacity-50" : undefined}
                  >
                    <div className="flex items-center gap-1">
                      <PersonPicker
                        open={openPickerId === group.id}
                        onOpenChange={(open) =>
                          setOpenPickerId(open ? group.id : null)
                        }
                        title={group.label}
                        triggerLabel={group.label}
                        items={pickerItems}
                        selectedId={selectedId}
                        onSelect={(personId) =>
                          void applyPerson(group, personId)
                        }
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
                    {missing && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Полів немає в документі
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {simple.length > 0 && (
          <section className="p-3">
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">
              Поля документа
            </h3>
            <div className="space-y-2">
              {simple.map((field) => {
                const missing = !presentTags.has(field.key)
                return (
                  <div
                    key={field.key}
                    className={missing ? "opacity-50" : undefined}
                  >
                    <label
                      className="mb-1 block truncate text-sm"
                      title={field.label}
                    >
                      {field.label}
                    </label>
                    <div className="flex items-center gap-1">
                      <Input
                        value={simpleValues[field.key] ?? ""}
                        onChange={(event) =>
                          setSimpleValues((prev) => ({
                            ...prev,
                            [field.key]: event.target.value,
                          }))
                        }
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
                        disabled={
                          !(simpleValues[field.key] ?? "").trim() || missing
                        }
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

        {groups.length === 0 && simple.length === 0 && staffGroups.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">
            У шаблона немає полів заповнення.
          </p>
        )}
      </aside>
    </>
  )
}
