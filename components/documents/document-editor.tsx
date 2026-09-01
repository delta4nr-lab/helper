"use client"

import * as React from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import type { Editor } from "@tiptap/react"
import { getMarkRange } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { TableKit } from "@tiptap/extension-table"
import TextAlign from "@tiptap/extension-text-align"
import { BadgeCheck, BriefcaseBusiness, Contact, Loader2, Save, Signature } from "lucide-react"

import { Button } from "@/components/ui/button"
import { A4_PX, A4_PADDING } from "@/components/editor/a4-page"
import { PersonPicker } from "@/components/documents/person-picker"
import { FillMark } from "@/lib/documents/editor/fill-mark"
import { composeDocumentHtml } from "@/lib/documents/editor/fill-html"
import { ParagraphWithIndent, StyledTable } from "@/lib/documents/editor/extensions"
import { SignatureImageNode } from "@/lib/documents/editor/signature-image"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"

const SPECIAL_FIELD_TYPES = new Set(["signature", "rank", "person", "position"])

type FieldConfig = {
  key: string
  label: string
  type: string
  required: boolean
  placeholder?: string | null
  options?: unknown
  sortOrder: number
}

type Personnel = {
  id: string
  lastName: string
  firstName: string
  middleName: string | null
  rank: string
  position: string
  signaturePath: string | null
}

// Поле, над яким наведена миша — для показу тригера вибору особи без зміни selection.
type PickerTarget = {
  key: string
  type: string
  label: string
  pos: number
  x: number
  y: number
  hasSignature: boolean
  groupPersonId: string | null
}

type Props = {
  template: {
    id: string
    title: string
    paper?: string | null
    headerTemplate?: string | null
    bodyTemplate?: string | null
    footerTemplate?: string | null
  }
  fields: FieldConfig[]
  personnel: Personnel[]
}

const MENU_LABELS: Record<string, string> = {
  position: "Посада — оберіть зі штату",
  rank: "Звання — оберіть зі штату",
  person: "ПІБ — оберіть зі штату",
  signature: "Підпис — оберіть особу",
}

// Порожній невидимий символ — вміст поля «Підпис» після вибору особи, щоб над підписом не було ПІБ
const ZWSP = "\u200B"

function fullName(p: Personnel): string {
  return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ")
}

export function DocumentEditor({ template, fields, personnel }: Props) {
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const triggerWrapRef = React.useRef<HTMLDivElement>(null)
  const mouseDownRef = React.useRef(false)

  const [menuOpen, setMenuOpen] = React.useState(false)
  const [pickerTarget, setPickerTarget] = React.useState<PickerTarget | null>(null)
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<{ ok: boolean; message: string } | null>(null)

  const initialContent = React.useMemo(
    () =>
      composeDocumentHtml(
        { header: template.headerTemplate, body: template.bodyTemplate, footer: template.footerTemplate },
        fields
      ),
    [template.headerTemplate, template.bodyTemplate, template.footerTemplate, fields]
  )
  const noContent = initialContent === null

  const editor = useEditor({
    immediatelyRender: false,
    editable: !noContent,
    extensions: [
      StarterKit.configure({ horizontalRule: false, paragraph: false }),
      ParagraphWithIndent,
      TableKit.configure({ table: false }),
      StyledTable,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Почніть писати..." }),
      FillMark,
      SignatureImageNode,
    ],
    content: initialContent ?? "<p></p>",
    editorProps: {
      attributes: {
        class: "document-fill-editor prose prose-sm max-w-none focus:outline-none",
        style: "font-family: 'Times New Roman', serif; font-size: 18px;",
      },
    },
    onSelectionUpdate: ({ editor }) => handleFieldSelection(editor),
  })

  // Клік мишею по fill-полю: якщо вміст — це назва поля (незаповнене), виділяємо його,
  // щоб друк одразу замінив підпис.
  function handleFieldSelection(ed: Editor) {
    if (!mouseDownRef.current) return
    mouseDownRef.current = false
    if (!ed.isActive("fill")) return
    const attrs = (ed.getAttributes("fill") ?? {}) as { fillKey?: string; fillType?: string; fillLabel?: string }
    const label = attrs.fillLabel ?? attrs.fillKey ?? ""
    const range = getMarkRange(ed.state.doc.resolve(ed.state.selection.from), ed.schema.marks.fill)
    if (!range) return
    const text = ed.state.doc.textBetween(range.from, range.to, " ")
    if (text === label) ed.commands.setTextSelection(range)
  }

  // Кеш групи для hover-поля — не перераховуємо на кожен mousemove
  const groupCacheRef = React.useRef<{ pos: number; hasSignature: boolean; groupPersonId: string | null } | null>(null)
  // Прямокутник hover-поля (viewport-координати) — для «зони утримання» тригера
  const fieldRectRef = React.useRef<{ left: number; top: number; right: number; bottom: number } | null>(null)

  function computeGroup(target: { pos: number; key: string }): { hasSignature: boolean; groupPersonId: string | null } {
    const cache = groupCacheRef.current
    if (cache && cache.pos === target.pos) {
      return { hasSignature: cache.hasSignature, groupPersonId: cache.groupPersonId }
    }
    const suffix = target.key.match(/_(\d+)$/)?.[1] ?? target.key
    const result = {
      hasSignature: groupHasSignature(suffix, target.pos),
      groupPersonId: groupPerson(suffix, target.pos),
    }
    groupCacheRef.current = { pos: target.pos, ...result }
    return result
  }

  // Поле (special) під курсором миші — для показу тригера по наведенню.
  function findPickerTarget(event: React.MouseEvent): PickerTarget | null {
    if (!editor) return null
    const el = (event.target as HTMLElement | null)?.closest?.("span[data-fill-key]")
    if (!(el instanceof HTMLElement)) return null
    const type = el.getAttribute("data-fill-type") ?? "text"
    if (!SPECIAL_FIELD_TYPES.has(type)) return null
    const pos = editor.view.posAtDOM(el, 0)
    if (pos == null) return null
    const range = getMarkRange(editor.state.doc.resolve(pos), editor.schema.marks.fill)
    if (!range) return null
    const from = editor.view.coordsAtPos(range.from)
    const to = editor.view.coordsAtPos(range.to)
    const key = el.getAttribute("data-fill-key") ?? ""
    const wrapper = wrapperRef.current?.getBoundingClientRect()
    fieldRectRef.current = { left: from.left, top: from.top, right: to.right, bottom: from.bottom }
    return {
      key,
      type,
      label: el.getAttribute("data-fill-label") ?? key,
      pos,
      x: wrapper ? from.left - wrapper.left : from.left,
      y: wrapper ? from.top - wrapper.top : from.top,
      ...computeGroup({ pos, key }),
    }
  }

  // Оновлює стан групи (підпис/особа) для поточного hover-поля після зміни документа.
  function refreshPickerTarget() {
    groupCacheRef.current = null
    setPickerTarget((prev) => {
      if (!prev || !editor) return prev
      return { ...prev, ...computeGroup({ pos: prev.pos, key: prev.key }) }
    })
  }

  const pickablePersons = React.useMemo(() => {
    if (!pickerTarget) return []
    // Якщо група вже прив'язана до особи — у полях посада/звання/підпис показуємо лише її,
    // щоб випадково не вибрати іншу людину. ПІБ завжди показує весь штат (зміна особи).
    const candidates =
      pickerTarget.groupPersonId && pickerTarget.type !== "person" ? personnel.filter((p) => p.id === pickerTarget.groupPersonId) : personnel
    return candidates.map((p) => ({
      id: p.id,
      name: fullName(p),
      position: p.position,
      rank: p.rank,
    }))
  }, [pickerTarget, personnel])

  const triggerText = React.useMemo(() => {
    if (!pickerTarget) return ""
    if (pickerTarget.type === "person" && pickerTarget.groupPersonId) {
      const person = personnel.find((p) => p.id === pickerTarget.groupPersonId)
      if (person) return fullName(person)
    }
    return pickerTarget.label
  }, [pickerTarget, personnel])

  const fieldIcon =
    pickerTarget?.type === "position" ? (
      <BriefcaseBusiness className="size-4 shrink-0" />
    ) : pickerTarget?.type === "rank" ? (
      <BadgeCheck className="size-4 shrink-0" />
    ) : pickerTarget?.type === "signature" ? (
      <Signature className="size-4 shrink-0" />
    ) : (
      <Contact className="size-4 shrink-0" />
    )

  // Блок (абзац/комірка), в якому знаходиться позиція — для групування полів без числового суфікса
  function resolveGroupBlock(anchorPos: number): { from: number; to: number } | null {
    if (!editor) return null
    const $r = editor.state.doc.resolve(anchorPos)
    let d = $r.depth
    while (d > 0 && $r.node(d).isInline) d -= 1
    if (d === 0) return null
    return { from: $r.before(d), to: $r.after(d) }
  }

  // Застосовує до всіх fill-полів групи функцію update.
  // Група: поля з тим самим числовим суфіксом (напр. *_1) по всьому документу,
  // а для полів без суфікса — усі спеціальні поля в тому ж блоці (абзаці/комірці).
  // update повертає marked-вузол (текст або зображення підпису) для вставки, або null — лишити як є.
  function updateGroupFields(
    suffix: string,
    update: (attrs: { fillKey: string; fillType: string; fillLabel: string; personId: string | null }) =>
      | { content: ProseMirrorNode }
      | null,
    anchorPos?: number
  ) {
    if (!editor) return
    const fillType = editor.schema.marks.fill
    const state = editor.state
    const ops: { from: number; to: number; content: ProseMirrorNode }[] = []
    const seen = new Set<string>()
    const numeric = /^\d+$/.test(suffix)
    const block = anchorPos != null ? resolveGroupBlock(anchorPos) : null
    state.doc.descendants((node, pos) => {
      if (!node.isInline) return true
      const mark = node.marks.find((m) => m.type === fillType)
      if (!mark) return true
      const attrs = mark.attrs as { fillKey?: string; fillType?: string; fillLabel?: string; personId?: string | null }
      const key = attrs.fillKey ?? ""
      if (numeric) {
        if (!key.endsWith(`_${suffix}`)) return true
      } else {
        if (!block) return true
        if (pos < block.from || pos >= block.to) return true
      }
      const range = getMarkRange(state.doc.resolve(pos), fillType)
      if (!range) return true
      const rangeKey = `${range.from}-${range.to}`
      if (seen.has(rangeKey)) return true
      seen.add(rangeKey)
      const result = update({
        fillKey: key,
        fillType: attrs.fillType ?? "text",
        fillLabel: attrs.fillLabel ?? key,
        personId: attrs.personId ?? null,
      })
      if (result) ops.push({ from: range.from, to: range.to, content: result.content })
      return true
    })
    if (ops.length === 0) return
    const tr = state.tr
    for (const op of ops.reverse()) {
      tr.delete(op.from, op.to)
      tr.insert(op.from, op.content)
    }
    editor.view.dispatch(tr)
    editor.commands.focus()
  }

  // Чи є в групі заповнений підпис (щоб показати дію «Видалити підпис»)
  function groupHasSignature(suffix: string, anchorPos?: number): boolean {
    if (!editor) return false
    const fillType = editor.schema.marks.fill
    const numeric = /^\d+$/.test(suffix)
    const block = anchorPos != null ? resolveGroupBlock(anchorPos) : null
    let found = false
    editor.state.doc.descendants((node, pos) => {
      if (!node.isInline) return true
      const mark = node.marks.find((m) => m.type === fillType)
      if (!mark) return true
      const attrs = mark.attrs as { fillKey?: string; fillType?: string; personId?: string | null }
      if (attrs.fillType !== "signature") return true
      const key = attrs.fillKey ?? ""
      if (numeric) {
        if (!key.endsWith(`_${suffix}`)) return true
      } else {
        if (!block) return true
        if (pos < block.from || pos >= block.to) return true
      }
      if (attrs.personId) found = true
      return true
    })
    return found
  }

  // Особу, прив'язану до групи (з будь-якого заповненого поля) — для фільтрації меню.
  function groupPerson(suffix: string, anchorPos?: number): string | null {
    if (!editor) return null
    const fillType = editor.schema.marks.fill
    const numeric = /^\d+$/.test(suffix)
    const block = anchorPos != null ? resolveGroupBlock(anchorPos) : null
    let result: string | null = null
    editor.state.doc.descendants((node, pos) => {
      if (result) return false
      if (!node.isInline) return true
      const mark = node.marks.find((m) => m.type === fillType)
      if (!mark) return true
      const attrs = mark.attrs as { fillKey?: string; personId?: string | null }
      const key = attrs.fillKey ?? ""
      if (numeric) {
        if (!key.endsWith(`_${suffix}`)) return true
      } else {
        if (!block) return true
        if (pos < block.from || pos >= block.to) return true
      }
      if (attrs.personId) {
        result = attrs.personId
        return false
      }
      return true
    })
    return result
  }

  // Вибір особи зі штату → заповнює всю групу (ПІБ, посада, звання, підпис) її даними.
  function applyPerson(personId: string, target: PickerTarget) {
    if (!editor) return
    const person = personnel.find((p) => p.id === personId)
    if (!person) return
    const state = editor.state
    const fillType = state.schema.marks.fill
    const suffix = target.key.match(/_(\d+)$/)?.[1] ?? target.key
    const anchorPos = target.pos
    updateGroupFields(suffix, (attrs) => {
      const mark = fillType.create({
        fillKey: attrs.fillKey,
        fillType: attrs.fillType,
        fillLabel: attrs.fillLabel,
        personId: person.id,
      })
      if (attrs.fillType === "person") return { content: state.schema.text(fullName(person), [mark]) }
      if (attrs.fillType === "position") return { content: state.schema.text(person.position, [mark]) }
      if (attrs.fillType === "rank") return { content: state.schema.text(person.rank, [mark]) }
      if (attrs.fillType === "signature") {
        // Над підписом ПІБ не виводимо — лише зображення підпису (або порожнє поле, якщо файлу немає)
        if (person.signaturePath) {
          const img = state.schema.nodes.signatureImage.create({ src: person.signaturePath, fillKey: attrs.fillKey, personId: person.id })
          return { content: img.mark([mark]) }
        }
        return { content: state.schema.text(ZWSP, [mark]) }
      }
      return null
    }, anchorPos)
    refreshPickerTarget()
    setMenuOpen(false)
  }

  // Скидає всю групу — поля повертаються до підписів (незаповнені), особа знімається.
  function clearGroup(target: PickerTarget) {
    if (!editor) return
    const state = editor.state
    const fillType = state.schema.marks.fill
    const suffix = target.key.match(/_(\d+)$/)?.[1] ?? target.key
    const anchorPos = target.pos
    updateGroupFields(suffix, (attrs) => {
      const mark = fillType.create({ fillKey: attrs.fillKey, fillType: attrs.fillType, fillLabel: attrs.fillLabel, personId: null })
      return { content: state.schema.text(attrs.fillLabel, [mark]) }
    }, anchorPos)
    refreshPickerTarget()
    setMenuOpen(false)
  }

  // Видаляє лише підпис у групі (ПІБ/посада/звання лишаються), повертаючи напис «Підпис».
  function clearSignature(target: PickerTarget) {
    if (!editor) return
    const state = editor.state
    const fillType = state.schema.marks.fill
    const suffix = target.key.match(/_(\d+)$/)?.[1] ?? target.key
    const anchorPos = target.pos
    updateGroupFields(suffix, (attrs) => {
      if (attrs.fillType !== "signature") return null
      const mark = fillType.create({ fillKey: attrs.fillKey, fillType: attrs.fillType, fillLabel: attrs.fillLabel, personId: null })
      return { content: state.schema.text(attrs.fillLabel, [mark]) }
    }, anchorPos)
    refreshPickerTarget()
    setMenuOpen(false)
  }

  async function onExport() {
    if (!editor) return
    setPending(true)
    setMessage(null)
    try {
      const html = editor.getHTML()
      const response = await fetch(`/api/templates/${template.id}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html }),
      })
      const result = (await response.json()) as { message?: string; downloadUrl?: string }
      if (!response.ok) {
        setMessage({ ok: false, message: result.message ?? "Не вдалося експортувати документ." })
        return
      }
      setMessage({ ok: true, message: "DOCX збережено у вашому профілі. Завантаження розпочато." })
      if (result.downloadUrl) {
        const link = window.document.createElement("a")
        link.href = result.downloadUrl
        link.download = ""
        link.click()
      }
    } catch {
      setMessage({ ok: false, message: "Не вдалося підключитися до сервера. Спробуйте ще раз." })
    } finally {
      setPending(false)
    }
  }

  const isLandscape = template.paper === "А4 альбом"
  const pageWidth = isLandscape ? A4_PX.landscapeWidth : A4_PX.width
  const pageHeight = isLandscape ? A4_PX.landscapeHeight : A4_PX.height

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{template.title}</h2>
          <p className="text-xs text-muted-foreground">
            Клікніть на жовтий блок і надрукуйте значення. Поля підписанта (Посада, Звання, Підпис, ПІБ) — через «+».
          </p>
        </div>
        <div className="flex items-center gap-2">
          {message && (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                message.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30" : "bg-destructive/10 text-destructive"
              }`}
            >
              {message.message}
            </p>
          )}
          <Button type="button" disabled={pending || noContent} onClick={onExport} className="cursor-pointer">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Експортувати DOCX
          </Button>
        </div>
      </div>

      <div ref={wrapperRef} className="relative">
        <div
          className="a4-paper mx-auto bg-white text-[13px] leading-relaxed text-zinc-900 shadow-sm ring-1 ring-black/5"
          style={{
            fontFamily: "Times New Roman, serif",
            width: pageWidth,
            minHeight: pageHeight,
            padding: A4_PADDING,
            boxSizing: "border-box",
            maxWidth: "100%",
          }}
          onMouseDown={() => {
            mouseDownRef.current = true
          }}
          onMouseMove={(event) => {
            // Тригер з'являється просто по наведенню на будь-яке спеціальне поле.
            // Поки попап відкритий — не рухаємо. Якщо миша в «зоні утримання»
            // (поле + область над ним, де висить тригер) — тригер не зникає,
            // щоб користувач встиг на нього навести.
            if (menuOpen) return
            const target = findPickerTarget(event)
            if (target) {
              setPickerTarget((prev) => {
                if (
                  prev &&
                  prev.pos === target.pos &&
                  prev.x === target.x &&
                  prev.y === target.y &&
                  prev.hasSignature === target.hasSignature &&
                  prev.groupPersonId === target.groupPersonId
                ) {
                  return prev
                }
                return target
              })
            } else {
              const onTrigger = triggerWrapRef.current?.contains(event.target as Node)
              const rect = fieldRectRef.current
              const inZone = rect
                ? event.clientX >= rect.left - 28 &&
                  event.clientX <= rect.right + 28 &&
                  event.clientY >= rect.top - 120 &&
                  event.clientY <= rect.bottom + 28
                : false
              if (!onTrigger && !inZone) setPickerTarget((prev) => (prev ? null : prev))
            }
          }}
        >
          {noContent ? (
            <div className="flex min-h-[40vh] items-center justify-center p-8 text-center text-sm text-muted-foreground">
              <p>
                Шаблон не має вмісту.
                <br />
                Відредагуйте його в адмін-панелі.
              </p>
            </div>
          ) : (
            <EditorContent editor={editor} />
          )}
        </div>

        {pickerTarget && (
          <div ref={triggerWrapRef} className="absolute z-50 -translate-y-[125%] translate-x-2" style={{ left: pickerTarget.x, top: pickerTarget.y }}>
            <PersonPicker
              open={menuOpen}
              onOpenChange={setMenuOpen}
              title={MENU_LABELS[pickerTarget.type] ?? "Шаблони"}
              icon={fieldIcon}
              triggerLabel={triggerText}
              items={pickablePersons}
              selectedId={pickerTarget.groupPersonId}
              onSelect={(personId) => applyPerson(personId, pickerTarget)}
              onClear={() => clearGroup(pickerTarget)}
              onClearSignature={() => clearSignature(pickerTarget)}
              showClearSignature={pickerTarget.hasSignature}
            />
          </div>
        )}
      </div>
    </div>
  )
}