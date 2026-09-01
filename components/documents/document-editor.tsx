"use client"

import * as React from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import type { Editor } from "@tiptap/react"
import { getMarkRange } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { TableKit } from "@tiptap/extension-table"
import TextAlign from "@tiptap/extension-text-align"
import { Loader2, Plus, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { A4_PX, A4_PADDING } from "@/components/editor/a4-page"
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
  const plusRef = React.useRef<HTMLButtonElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const mouseDownRef = React.useRef(false)

  const [activeFill, setActiveFill] = React.useState<{ key: string; type: string; personId: string | null; label: string } | null>(null)
  const [plusPos, setPlusPos] = React.useState<{ x: number; y: number } | null>(null)
  const [menuOpen, setMenuOpen] = React.useState(false)
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
    onSelectionUpdate: ({ editor }) => updateActiveField(editor),
    onUpdate: ({ editor }) => updateActiveField(editor),
  })

  function updateActiveField(ed: Editor) {
    const fillActive = ed.isActive("fill")
    const sigActive = ed.isActive("signatureImage")

    let key = ""
    let type = ""
    let label = ""
    let personId: string | null = null

    if (fillActive) {
      const attrs = (ed.getAttributes("fill") ?? {}) as {
        fillKey?: string
        fillType?: string
        fillLabel?: string
        personId?: string | null
      }
      type = attrs.fillType ?? "text"
      if (!SPECIAL_FIELD_TYPES.has(type)) {
        setActiveFill(null)
        setPlusPos(null)
        return
      }
      key = attrs.fillKey ?? ""
      label = attrs.fillLabel ?? key
      personId = attrs.personId ?? null
    } else if (sigActive) {
      const attrs = (ed.getAttributes("signatureImage") ?? {}) as { fillKey?: string; personId?: string | null }
      key = attrs.fillKey ?? ""
      type = "signature"
      label = "Підпис"
      personId = attrs.personId ?? null
    } else {
      setActiveFill(null)
      setPlusPos(null)
      return
    }

    setActiveFill({ key, type, personId, label })

    // Перший клік мишею по ще не заповненому полю → виділити весь вміст, щоб друк одразу замінив підпис
    if (mouseDownRef.current) {
      const range = getMarkRange(ed.state.doc.resolve(ed.state.selection.from), ed.schema.marks.fill)
      if (range) {
        const text = ed.state.doc.textBetween(range.from, range.to, " ")
        if (text === label) ed.commands.setTextSelection(range)
      }
      mouseDownRef.current = false
    }

    const wrapper = wrapperRef.current?.getBoundingClientRect()
    const coords = ed.view.coordsAtPos(ed.state.selection.from)
    if (wrapper) setPlusPos({ x: coords.left - wrapper.left, y: coords.top - wrapper.top })
  }

  React.useEffect(() => {
    if (!menuOpen) return
    function onDocClick(event: MouseEvent) {
      const target = event.target as Node
      const inPlus = plusRef.current?.contains(target)
      const inMenu = menuRef.current?.contains(target)
      if (!inPlus && !inMenu) setMenuOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [menuOpen])

  const menuItems = React.useMemo(() => {
    if (!activeFill) return []
    const seen = new Set<string>()
    const items: { label: string; personId: string }[] = []
    for (const p of personnel) {
      const value =
        activeFill.type === "position"
          ? p.position
          : activeFill.type === "rank"
            ? p.rank
            : fullName(p)
      if (!value || seen.has(value)) continue
      seen.add(value)
      items.push({ label: value, personId: p.id })
    }
    return items
  }, [activeFill, personnel])

  // Застосовує до всіх fill-полів групи (однаковий числовий суфікс, напр. *_1) функцію update.
  // update повертає marked-вузол (текст або зображення підпису) для вставки, або null — лишити як є.
  function updateGroupFields(
    suffix: string,
    update: (attrs: { fillKey: string; fillType: string; fillLabel: string; personId: string | null }) =>
      | { content: ProseMirrorNode }
      | null
  ) {
    if (!editor) return
    const fillType = editor.schema.marks.fill
    const state = editor.state
    const ops: { from: number; to: number; content: ProseMirrorNode }[] = []
    const seen = new Set<string>()
    state.doc.descendants((node, pos) => {
      if (!node.isInline) return true
      const mark = node.marks.find((m) => m.type === fillType)
      if (!mark) return true
      const attrs = mark.attrs as { fillKey?: string; fillType?: string; fillLabel?: string; personId?: string | null }
      const key = attrs.fillKey ?? ""
      if (!key.endsWith(`_${suffix}`)) return true
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

  // Вибір особи зі штату → заповнює всю групу (ПІБ, посада, звання, підпис) її даними.
  function applyPerson(personId: string) {
    if (!editor || !activeFill) return
    const person = personnel.find((p) => p.id === personId)
    if (!person) return
    const state = editor.state
    const fillType = state.schema.marks.fill
    const suffix = activeFill.key.match(/_(\d+)$/)?.[1] ?? activeFill.key
    updateGroupFields(suffix, (attrs) => {
      const mark = fillType.create({
        fillKey: attrs.fillKey,
        fillType: attrs.fillType,
        fillLabel: attrs.fillLabel,
        personId: attrs.fillType === "signature" ? person.id : null,
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
    })
    setMenuOpen(false)
  }

  // Скидає всю групу — поля повертаються до підписів (незаповнені), особа знімається.
  function clearGroup() {
    if (!editor || !activeFill) return
    const state = editor.state
    const fillType = state.schema.marks.fill
    const suffix = activeFill.key.match(/_(\d+)$/)?.[1] ?? activeFill.key
    updateGroupFields(suffix, (attrs) => {
      const mark = fillType.create({ fillKey: attrs.fillKey, fillType: attrs.fillType, fillLabel: attrs.fillLabel, personId: null })
      return { content: state.schema.text(attrs.fillLabel, [mark]) }
    })
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

        {activeFill && plusPos && (
          <div className="absolute z-50" style={{ left: plusPos.x, top: plusPos.y }}>
            <button
              ref={plusRef}
              type="button"
              aria-label="Шаблони для поля"
              title={MENU_LABELS[activeFill.type] ?? "Шаблони"}
              onClick={() => setMenuOpen((open) => !open)}
              className="flex size-7 -translate-y-1/2 translate-x-1 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md ring-2 ring-white hover:bg-primary/90"
            >
              <Plus className="size-4" />
            </button>
            {menuOpen && (
              <div
                ref={menuRef}
                className="absolute left-0 top-2 z-50 mt-1 w-72 overflow-hidden rounded-lg border bg-popover shadow-lg"
              >
                <div className="max-h-64 overflow-y-auto p-1">
                  <div className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
                    {MENU_LABELS[activeFill.type] ?? "Шаблони"}
                  </div>
                  {menuItems.length === 0 ? (
                    <div className="px-3 py-4 text-center text-xs text-muted-foreground">Штат порожній</div>
                  ) : (
                    menuItems.map((item) => (
                      <button
                        key={`${item.personId}-${item.label}`}
                        type="button"
                        onClick={() => applyPerson(item.personId)}
                        className="flex w-full items-center rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted"
                      >
                        {item.label}
                      </button>
                    ))
                  )}
                  <div className="my-1 h-px bg-border" />
                  <button
                    type="button"
                    onClick={clearGroup}
                    className="flex w-full items-center rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
                  >
                    Очистити (зняти особу)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}