"use client"

import * as React from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { TableKit } from "@tiptap/extension-table"
import { FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style"
import TextAlign from "@tiptap/extension-text-align"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Columns3,
  Eye,
  EyeOff,
  IndentIncrease,
  Italic,
  Plus,
  Rows3,
  Table2,
  Trash2,
  Underline as UnderlineIcon,
  Ruler,
  Equal,
  Maximize2,
  Signature,
  BriefcaseBusiness,
  BadgeCheck,
  Contact,
} from "lucide-react"

import { FieldExtension } from "@/lib/documents/editor/field-extension"
import { hasParagraphIndent, setParagraphIndent, ParagraphWithIndent, StyledTable } from "@/lib/documents/editor/extensions"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { A4_PX, A4_PADDING, type PaperKind } from "@/components/editor/a4-page"

type Props = {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  onFocus?: () => void
  paper?: PaperKind | string | null
  // Висота аркуша A4 в редакторі (px). За замовчуванням — повна сторінка.
  // Менше значення зручно для коротких секцій (напр. «шапка»), щоб не гортати пусте місце.
  pageHeight?: number
}

// ── column helpers (prosemirror-tables) ────────────────────────────────────
function getTableContext(editor: NonNullable<ReturnType<typeof useEditor>>) {
  const { state } = editor
  const $from = state.selection.$from
  let depth = $from.depth
  while (depth > 0 && $from.node(depth).type.name !== "table") depth -= 1
  if (depth === 0) return null
  const tablePos = $from.before(depth)
  const tableNode = $from.node(depth)
  return { tablePos, tableNode, $from, depth }
}

function getSelectedColumnIndex(editor: NonNullable<ReturnType<typeof useEditor>>): number | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TableMap } = require("@tiptap/pm/tables") as typeof import("@tiptap/pm/tables")
    const ctx = getTableContext(editor)
    if (!ctx) return null
    const map = TableMap.get(ctx.tableNode)
    // find cell at selection
    const $anchor = editor.state.selection.$anchor as unknown as { pos: number; start: (d: number) => number; node: (d: number) => { type: { name: string } } }
    // fallback: use $from depth-1 cell
    const $from = ctx.$from
    // find cell depth
    let cellDepth = $from.depth
    while (cellDepth > 0 && !["tableCell", "tableHeader", "table_cell", "table_header"].includes($from.node(cellDepth).type.name)) cellDepth -= 1
    if (cellDepth === 0) {
      // selection might be CellSelection — try to get first selected cell
      const sel = editor.state.selection as unknown as { $anchorCell?: { pos: number } }
      if (sel.$anchorCell) {
        const tableStart = ctx.tablePos + 1
        const rel = sel.$anchorCell.pos - tableStart
        const col = map.colCount(rel)
        return col
      }
      return 0
    }
    const cellPos = $from.before(cellDepth)
    const tableStart = ctx.tablePos + 1
    const rel = cellPos - tableStart
    // TableMap has colCount(pos)
    const col = map.colCount(rel)
    void $anchor
    return col
  } catch {
    return null
  }
}

function readColumnWidthsPx(editor: NonNullable<ReturnType<typeof useEditor>>): number[] {
  try {
    const el = editor.view.dom as HTMLElement
    const table = el.querySelector("table") as HTMLTableElement | null
    if (!table) return []
    const cols = table.querySelectorAll("col")
    if (cols.length > 0) {
      return Array.from(cols).map((c) => {
        const w = (c as HTMLElement).style.width
        if (w.endsWith("px")) return Math.round(parseFloat(w))
        if (w.endsWith("pt")) return Math.round(parseFloat(w) * 1.333)
        return 0
      })
    }
    // fallback: measure cells first row
    const firstRow = table.querySelector("tr")
    if (firstRow) {
      const cells = firstRow.querySelectorAll("td, th")
      return Array.from(cells).map((cell) => Math.round((cell as HTMLElement).getBoundingClientRect().width))
    }
    return []
  } catch {
    return []
  }
}

function setColumnWidth(editor: NonNullable<ReturnType<typeof useEditor>>, colIndex: number, widthPx: number): boolean {
  const clamped = Math.max(24, Math.min(600, Math.round(widthPx)))
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TableMap } = require("@tiptap/pm/tables") as typeof import("@tiptap/pm/tables")
    const ctx = getTableContext(editor)
    if (!ctx) return false
    const { tableNode, tablePos } = ctx
    const map = TableMap.get(tableNode)
    if (colIndex < 0 || colIndex >= map.width) return false
    const cells = map.cellsInRect({ left: colIndex, right: colIndex + 1, top: 0, bottom: map.height })
    const tr = editor.state.tr
    const tableStart = tablePos + 1
    let changed = false
    for (const rel of cells) {
      const pos = tableStart + rel
      const cell = tr.doc.nodeAt(pos)
      if (!cell) continue
      // colwidth is array of numbers per colspan
      const colspan = cell.attrs.colspan as number | undefined
      const span = colspan ?? 1
      if (span !== 1) {
        // merged cell spanning multiple cols — skip or distribute
        if (span > 1) {
          // if this cell spans our target col, its colwidth should have entry for that sub-column
          // prosemirror stores colwidth as array length == colspan, e.g. [100,100] for 2 cols
          const existing = (cell.attrs.colwidth as number[] | null) ?? null
          if (existing && existing.length === span) {
            // which sub-index is our col?
            // find col of this cell
            const colOfCell = map.colCount(rel)
            const sub = colIndex - colOfCell
            if (sub >= 0 && sub < span) {
              const next = [...existing]
              next[sub] = clamped
              tr.setNodeMarkup(pos, undefined, { ...cell.attrs, colwidth: next })
              changed = true
            }
          } else {
            // create equal distribution then set
            const per = Math.round(clamped)
            const arr = Array.from({ length: span }, () => per)
            tr.setNodeMarkup(pos, undefined, { ...cell.attrs, colwidth: arr })
            changed = true
          }
        }
        continue
      }
      tr.setNodeMarkup(pos, undefined, { ...cell.attrs, colwidth: [clamped] })
      changed = true
    }
    if (changed) {
      editor.view.dispatch(tr)
      return true
    }
    return false
  } catch {
    return false
  }
}

function distributeColumnsEqually(editor: NonNullable<ReturnType<typeof useEditor>>, paper?: PaperKind | string | null): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TableMap } = require("@tiptap/pm/tables") as typeof import("@tiptap/pm/tables")
    const ctx = getTableContext(editor)
    if (!ctx) return false
    const { tableNode, tablePos } = ctx
    const map = TableMap.get(tableNode)
    const colCount = map.width
    if (colCount <= 0) return false
    const usable = paper === "А4 альбом" ? A4_PX.landscapeUsable : A4_PX.usable
    const per = Math.floor(usable / colCount)
    const widths = Array.from({ length: colCount }, (_, i) => (i === colCount - 1 ? usable - per * (colCount - 1) : per))
    const tr = editor.state.tr
    const tableStart = tablePos + 1
    for (let col = 0; col < colCount; col++) {
      const w = widths[col]!
      const cells = map.cellsInRect({ left: col, right: col + 1, top: 0, bottom: map.height })
      for (const rel of cells) {
        const pos = tableStart + rel
        const cell = tr.doc.nodeAt(pos)
        if (!cell) continue
        const span = (cell.attrs.colspan as number) ?? 1
        if (span !== 1) continue // merged cells skip for equal distribution — they will be fixed via TableView
        tr.setNodeMarkup(pos, undefined, { ...cell.attrs, colwidth: [w] })
      }
    }
    editor.view.dispatch(tr)
    return true
  } catch {
    return false
  }
}

function setTableWidthPercent(editor: NonNullable<ReturnType<typeof useEditor>>, pct: number | null) {
  try {
    const ctx = getTableContext(editor)
    if (!ctx) return
    const { tablePos, tableNode } = ctx
    const nextStyle = pct === null ? null : `width: ${pct}%`
    const tr = editor.state.tr
    const newAttrs = { ...tableNode.attrs, style: nextStyle }
    tr.setNodeMarkup(tablePos, undefined, newAttrs)
    editor.view.dispatch(tr)
  } catch {
    /* noop */
  }
}

// ── Styled Table ─────────────────────────────────────────────────────────────
type FieldType = "text" | "signature" | "rank" | "person" | "position"

// Вставляє спеціальне поле (підпис / звання+прізвище / посада) з унікальним ключем:
// signature_1, signature_2, person_1, position_1 …
function insertTypedField(editor: NonNullable<ReturnType<typeof useEditor>>, type: Exclude<FieldType, "text">, label: string) {
  const html = editor.getHTML()
  let max = 0
  for (const match of html.matchAll(/<span\b[^>]*data-field-key=["'](\w+)["'][^>]*>/gi)) {
    const typeMatch = match[0].match(/data-field-type=["'](\w+)["']/)
    if (typeMatch && typeMatch[1] === type) {
      const num = parseInt((match[1].match(/(\d+)$/) || [])[1] || "0", 10)
      if (Number.isFinite(num)) max = Math.max(max, num)
    }
  }
  const key = `${type}_${max + 1}`
  const nextLabel = max === 0 ? label : `${label} ${max + 1}`
  editor.chain().focus().insertContent({ type: "field", attrs: { fieldKey: key, label: nextLabel, type } }).run()
}

function toggleParagraphIndent(editor: NonNullable<ReturnType<typeof useEditor>>) {
  setParagraphIndent(editor, !hasParagraphIndent(editor))
}

// Розширення Paragraph: зберігає text-indent окремим атрибутом (як TextAlign зберігає text-align),
// щоб не конфліктувати з вирівнюванням і не перезаписувати style абзацу.

export type TiptapEditorHandle = {
  insertField: (fieldKey: string, label: string) => void
}

function htmlWithFields(html: string): string {
  const cleaned = html.replace(/\{\{(\w+)\}\}"\s+contenteditable="false">([^<]*?),\s*\{\{\1\}\}/g, '<span data-field-key="$1" data-label="$2">$2</span>')
  const fields: string[] = []
  const protectedHtml = cleaned.replace(/<span\b[^>]*data-field-key=["']\w+["'][^>]*>[\s\S]*?<\/span>/gi, (field) => {
    fields.push(field)
    return `__FIELD_NODE_${fields.length - 1}__`
  })
  const withNewFields = protectedHtml.replace(/\{\{(\w+)\}\}/g, '<span data-field-key="$1" data-label="$1">$1</span>')
  return withNewFields.replace(/__FIELD_NODE_(\d+)__/g, (_, index: string) => fields[Number(index)] ?? "")
}

export const TiptapEditor = React.forwardRef<TiptapEditorHandle, Props>(function TiptapEditor(
  { content, onChange, placeholder, className, onFocus, paper, pageHeight },
  ref
) {
  const [tableActive, setTableActive] = React.useState(false)
  const [borderlessTable, setBorderlessTable] = React.useState(false)
  const [tablePickerOpen, setTablePickerOpen] = React.useState(false)
  const [tableHover, setTableHover] = React.useState({ rows: 2, cols: 2 })
  const [selectedCol, setSelectedCol] = React.useState<number | null>(null)
  const [colWidthInput, setColWidthInput] = React.useState("")
  const [colCount, setColCount] = React.useState(0)
  const [paragraphIndent, setParagraphIndent] = React.useState(false)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ horizontalRule: false, paragraph: false }),
      ParagraphWithIndent,
      TableKit.configure({ table: false }),
      StyledTable,
      TextStyle,
      FontFamily,
      FontSize,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: placeholder ?? "Почніть писати..." }),
      FieldExtension,
    ],
    content: htmlWithFields(content || "<p></p>"),
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html)
      const active = editor.isActive("table")
      setTableActive(active)
      setBorderlessTable(editor.getAttributes("table").borderless === true)
      setParagraphIndent(hasParagraphIndent(editor))
      if (active) {
        const idx = getSelectedColumnIndex(editor)
        setSelectedCol(idx)
        const widths = readColumnWidthsPx(editor)
        setColCount(widths.length)
        if (idx !== null && widths[idx] !== undefined) setColWidthInput(String(widths[idx]))
        else if (widths.length > 0) setColWidthInput(String(widths[0]))
      }
    },
    onSelectionUpdate: ({ editor }) => {
      const active = editor.isActive("table")
      setTableActive(active)
      setBorderlessTable(editor.getAttributes("table").borderless === true)
      setParagraphIndent(hasParagraphIndent(editor))
      if (active) {
        const idx = getSelectedColumnIndex(editor)
        setSelectedCol(idx)
        const widths = readColumnWidthsPx(editor)
        setColCount(widths.length)
        if (idx !== null && widths[idx] !== undefined) setColWidthInput(String(widths[idx] ?? ""))
      } else {
        setSelectedCol(null)
      }
    },
    editorProps: {
      attributes: {
        style: "font-family: 'Times New Roman', serif; font-size: 18px;",
        class: cn(
          "min-h-[180px] w-full p-3 text-sm leading-relaxed focus:outline-none",
          "prose prose-sm max-w-none dark:prose-invert",
          className
        ),
      },
    },
  })
  const [fieldKey, setFieldKey] = React.useState("")
  const [fieldLabel, setFieldLabel] = React.useState("")

  React.useImperativeHandle(
    ref,
    () => ({
      insertField: (fieldKey, label) => editor?.chain().focus().insertContent({ type: "field", attrs: { fieldKey, label } }).run(),
    }),
    [editor]
  )

  React.useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const next = htmlWithFields(content || "<p></p>")
    if (current !== next) {
      const isFocused = editor.isFocused
      if (!isFocused) editor.commands.setContent(next, { emitUpdate: false } as never)
    }
  }, [content, editor])

  if (!editor) {
    return <div className="min-h-[180px] rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">Завантаження редактора...</div>
  }

  const toggleTableBorderless = () => {
    const borderless = !editor.getAttributes("table").borderless
    editor.commands.command(({ state, dispatch }) => {
      const { $from } = state.selection
      let depth = $from.depth
      while (depth > 0 && $from.node(depth).type.name !== "table") depth -= 1
      if (depth === 0) return false
      const table = $from.node(depth)
      if (dispatch) dispatch(state.tr.setNodeMarkup($from.before(depth), undefined, { ...table.attrs, borderless }))
      return true
    })
  }

  const insertTable = (rows: number, cols: number) => {
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: false }).run()
    setTablePickerOpen(false)
  }

  const applyColWidth = () => {
    if (selectedCol === null) return
    const v = Math.round(Number(colWidthInput))
    if (!Number.isFinite(v) || v < 24 || v > 800) return
    setColumnWidth(editor, selectedCol, v)
  }

  const isLandscape = paper === "А4 альбом"

  return (
    <div className="overflow-hidden rounded-lg border bg-background" onFocus={onFocus}>
      <div className="flex flex-wrap items-center gap-1 border-b bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
        <select
          defaultValue="Times New Roman"
          onChange={(event) => editor.chain().focus().setFontFamily(event.target.value).run()}
          className="h-7 rounded border bg-background px-1.5 text-xs text-foreground"
          aria-label="Шрифт"
        >
          <option>Times New Roman</option>
          <option>Arial</option>
          <option>Calibri</option>
        </select>
        <select
          defaultValue="18px"
          onChange={(event) => editor.chain().focus().setFontSize(event.target.value).run()}
          className="h-7 rounded border bg-background px-1.5 text-xs text-foreground"
          aria-label="Розмір шрифту"
        >
          {["10px", "11px", "12px", "14px", "16px", "18px", "20px", "24px"].map((size) => (
            <option key={size}>{size}</option>
          ))}
        </select>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Жирний" onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="size-3.5" />
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Курсив" onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="size-3.5" />
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Підкреслений" onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="size-3.5" />
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Ліворуч" onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          <AlignLeft className="size-3.5" />
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="По центру" onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          <AlignCenter className="size-3.5" />
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Праворуч" onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <AlignRight className="size-3.5" />
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="По ширині" onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
          <AlignJustify className="size-3.5" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-pressed={paragraphIndent}
          className={cn(paragraphIndent && "bg-primary/10 text-primary")}
          aria-label="Абзацний відступ"
          title="Абзацний відступ (червоний рядок)"
          onClick={() => toggleParagraphIndent(editor)}
        >
          <IndentIncrease className="size-3.5" />
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <DropdownMenu open={tablePickerOpen} onOpenChange={setTablePickerOpen}>
          <DropdownMenuTrigger render={<Button type="button" size="icon-sm" variant="ghost" aria-label="Вставити таблицю" title="Вставити таблицю" />}>
            <Table2 className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-auto p-3">
            <div className="mb-2 text-xs font-medium text-foreground">Вставити таблицю</div>
            <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(8, 18px)" }} onMouseLeave={() => setTableHover({ rows: 2, cols: 2 })}>
              {Array.from({ length: 48 }, (_, index) => {
                const row = Math.floor(index / 8) + 1
                const col = (index % 8) + 1
                const active = row <= tableHover.rows && col <= tableHover.cols
                return (
                  <button
                    key={`${row}-${col}`}
                    type="button"
                    className={cn("size-[18px] rounded-sm border transition-colors", active ? "border-primary bg-primary/20" : "border-border bg-muted/30 hover:border-primary/60")}
                    aria-label={`${row} рядків, ${col} стовпців`}
                    onMouseEnter={() => setTableHover({ rows: row, cols: col })}
                    onClick={() => insertTable(row, col)}
                  />
                )
              })}
            </div>
            <div className="mt-2 text-center text-xs text-muted-foreground">
              {tableHover.rows} × {tableHover.cols}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto flex items-center gap-1">
          <select
            defaultValue="paragraph"
            onChange={(event) => {
              const value = event.target.value
              if (value === "bulletList") editor.chain().focus().toggleBulletList().run()
              else if (value === "orderedList") editor.chain().focus().toggleOrderedList().run()
              else if (value === "heading") editor.chain().focus().toggleHeading({ level: 2 }).run()
              event.target.value = "paragraph"
            }}
            className="h-7 rounded border bg-background px-1.5 text-xs text-foreground"
            aria-label="Додати блок"
          >
            <option value="paragraph">Додати блок</option>
            <option value="heading">Заголовок</option>
            <option value="bulletList">Маркований список</option>
            <option value="orderedList">Нумерований список</option>
          </select>
          <input
            value={fieldKey}
            onChange={(event) => setFieldKey(event.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
            placeholder="назва поля"
            className="h-7 w-28 rounded border bg-background px-2 text-xs text-foreground outline-none"
            aria-label="Ключ поля"
          />
          <input
            value={fieldLabel}
            onChange={(event) => setFieldLabel(event.target.value)}
            placeholder="Підпис поля"
            className="h-7 w-32 rounded border bg-background px-2 text-xs text-foreground outline-none"
            aria-label="Підпис поля"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-xs"
            disabled={!fieldKey || !fieldLabel}
            onClick={() => {
              editor.chain().focus().insertContent({ type: "field", attrs: { fieldKey, label: fieldLabel } }).run()
              setFieldKey("")
              setFieldLabel("")
            }}
          >
            <Plus className="size-3" /> Поле
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-xs"
            title="Місце для підпису (пізніше обирається людина)"
            onClick={() => insertTypedField(editor, "signature", "Підпис")}
          >
            <Signature className="size-3" /> Підпис
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-xs"
            title="Звання людини"
            onClick={() => insertTypedField(editor, "rank", "Звання")}
          >
            <BadgeCheck className="size-3" /> Звання
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-xs"
            title="Прізвище, імʼя, по батькові"
            onClick={() => insertTypedField(editor, "person", "ПІБ")}
          >
            <Contact className="size-3" /> ПІБ
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-xs"
            title="Посада людини"
            onClick={() => insertTypedField(editor, "position", "Посада")}
          >
            <BriefcaseBusiness className="size-3" /> Посада
          </Button>
        </div>
      </div>
      {tableActive && (
        <div className="flex flex-wrap items-center gap-1 border-b bg-sky-50/70 px-2 py-1.5 text-xs dark:bg-sky-950/20">
          <span className="mr-1 font-medium text-foreground">Таблиця</span>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" />}>Рядок</DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Керування рядками</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => editor.chain().focus().addRowBefore().run()}>
                  <Rows3 className="size-4" />
                  Додати перед поточним
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().addRowAfter().run()}>
                  <Rows3 className="size-4" />
                  Додати після поточного
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => editor.chain().focus().deleteRow().run()}>
                  <Trash2 className="size-4" />
                  Видалити поточний
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" />}>Стовпець</DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-48">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Керування стовпцями</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => editor.chain().focus().addColumnBefore().run()}>
                  <Columns3 className="size-4" />
                  Додати перед поточним
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => editor.chain().focus().addColumnAfter().run()}>
                  <Columns3 className="size-4" />
                  Додати після поточного
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => editor.chain().focus().deleteColumn().run()}>
                  <Trash2 className="size-4" />
                  Видалити поточний
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="mx-1 h-5 w-px bg-border" />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-xs"
            disabled={!editor.can().mergeCells()}
            onClick={() => editor.chain().focus().mergeCells().run()}
          >
            Об’єднати
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-xs"
            disabled={!editor.can().splitCell()}
            onClick={() => editor.chain().focus().splitCell().run()}
          >
            Розділити
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-pressed={borderlessTable}
            className={cn("h-7 gap-1 px-2 text-xs", borderlessTable && "border-dashed bg-sky-100/80 dark:bg-sky-900/40")}
            onClick={toggleTableBorderless}
          >
            {borderlessTable ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            {borderlessTable ? "Межі: приховані" : "Межі: видимі"}
          </Button>
          <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
          <div className="flex items-center gap-1 rounded-md border bg-white px-1.5 py-1 dark:bg-zinc-900">
            <Ruler className="size-3.5 text-muted-foreground" />
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {colCount > 0 ? `Стовпець ${selectedCol !== null ? selectedCol + 1 : 1}/${colCount}` : "Стовпець"}
            </span>
            <input
              value={colWidthInput}
              onChange={(e) => setColWidthInput(e.target.value.replace(/[^0-9.]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyColWidth()
              }}
              placeholder="px"
              className="h-6 w-16 rounded border bg-background px-1.5 text-xs text-foreground outline-none focus:border-primary"
              aria-label="Ширина стовпця в пікселях"
              title="Ширина стовпця (px) — натисніть Enter"
            />
            <span className="text-xs text-muted-foreground">px</span>
            <Button type="button" size="icon-sm" variant="ghost" className="size-6" onClick={applyColWidth} title="Застосувати ширину">
              <Plus className="size-3" />
            </Button>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => distributeColumnsEqually(editor, paper)}
            title={`Розподілити рівномірно по ${A4_PX.usable}px (ширина друку A4)`}
          >
            <Equal className="size-3.5" /> Рівномірно
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" />}>
              <Maximize2 className="size-3.5" /> Ширина
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-40">
              <DropdownMenuLabel>Ширина таблиці</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setTableWidthPercent(editor, 100)}>100% (на всю сторінку)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTableWidthPercent(editor, null)}>Авто (за вмістом)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            <Trash2 className="size-3.5" /> Видалити таблицю
          </Button>
        </div>
      )}
      {tableActive && (
        <div className="flex items-center gap-1.5 border-b bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:bg-amber-950/20 dark:text-amber-200">
          <Ruler className="size-3" /> Потягніть межу між комірками щоб змінити ширину, або введіть px вище. Ширина друку {paper === "А4 альбом" ? "А4 альбом" : "А4"}:{" "}
          {paper === "А4 альбом" ? A4_PX.landscapeUsable : A4_PX.usable}px ({Math.round((paper === "А4 альбом" ? A4_PX.landscapeUsable : A4_PX.usable) / 3.78)}мм).
        </div>
      )}
      <div
        className={cn(paper ? "a4-page-outer bg-zinc-100 dark:bg-zinc-900 p-2 sm:p-4" : "")}
        style={paper ? { overflow: "auto" } : undefined}
      >
        <div
          className={cn(paper ? "a4-paper bg-white shadow-sm ring-1 ring-black/5" : "")}
          style={
            paper
              ? {
                  width: isLandscape ? A4_PX.landscapeWidth : A4_PX.width,
                  minHeight: pageHeight ?? (isLandscape ? A4_PX.landscapeHeight : A4_PX.height),
                  padding: A4_PADDING,
                  boxSizing: "border-box",
                  maxWidth: "100%",
                  margin: "0 auto",
                }
              : undefined
          }
        >
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
})

// A4 превʼю — як у Word, Times New Roman, з заміною {{field_1}}
export function TiptapPreview({ html, data, paper }: { html: string; data: Record<string, unknown>; paper?: PaperKind | string | null }) {
  const rendered = React.useMemo(() => {
    let out = html || ""
    // Збираємо назви полів (label), щоб у порожніх місцях показувати назву замість ключа
    const labels: Record<string, string> = {}
    out = out.replace(/<span\b[^>]*data-field-key=["'](\w+)["'][^>]*>[\s\S]*?<\/span>/gi, (match, key: string) => {
      const labelMatch = match.match(/data-label=["']([^"']*)["']/)
      labels[key] = labelMatch ? labelMatch[1] : key
      return `{{${key}}}`
    })
    out = out.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const v = data[key]
      if (v === undefined || v === null || v === "") return `<span class="field-chip">${labels[key] ?? key}</span>`
      return `<span class="field-chip">${String(v)}</span>`
    })
    // Пробіли навколо чіпа → нерозривні, щоб justify не розтягував їх (не було великого відступу зліва)
    out = out
      .replace(/\s+(?=<span[^>]*class="[^"]*field-chip)/gi, "&nbsp;")
      .replace(/(<span[^>]*class="[^"]*field-chip[^"]*">[\s\S]*?<\/span>)\s+/gi, "$1&nbsp;")
    return out
  }, [html, data])

  const isLandscape = paper === "А4 альбом"
  return (
    <div
      className="a4-paper mx-auto bg-white text-[13px] leading-relaxed text-zinc-900 shadow-sm ring-1 ring-black/5"
      style={{
        fontFamily: "Times New Roman, serif",
        width: isLandscape ? A4_PX.landscapeWidth : A4_PX.width,
        minHeight: isLandscape ? A4_PX.landscapeHeight : A4_PX.height,
        padding: A4_PADDING,
        boxSizing: "border-box",
        maxWidth: "100%",
      }}
    >
      {/* eslint-disable-next-line react/no-danger */}
      <div dangerouslySetInnerHTML={{ __html: rendered }} className="document-preview-content prose prose-sm max-w-none prose-p:my-2 prose-p:leading-relaxed" style={{ fontSize: "18px" }} />
    </div>
  )
}
