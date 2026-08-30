"use client"

import * as React from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { Table, TableKit, TableView } from "@tiptap/extension-table"
import { FontFamily, FontSize, TextStyle } from "@tiptap/extension-text-style"
import TextAlign from "@tiptap/extension-text-align"
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, Columns3, Eye, EyeOff, Italic, Plus, Rows3, Table2, Trash2, Underline as UnderlineIcon } from "lucide-react"

import { FieldExtension } from "@/lib/documents/editor/field-extension"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

type Props = {
  content: string // HTML або JSON string з {{field_1}} — конвертується в field nodes
  onChange: (html: string) => void
  placeholder?: string
  className?: string
  onFocus?: () => void
}

class StyledTableView extends TableView {
  constructor(...args: ConstructorParameters<typeof TableView>) {
    super(...args)
    this.syncBorderlessState(this.node)
  }

  update(node: Parameters<TableView["update"]>[0]) {
    const updated = super.update(node)
    if (updated) this.syncBorderlessState(node)
    return updated
  }

  private syncBorderlessState(node: Parameters<TableView["update"]>[0]) {
    const borderless = node.attrs.borderless === true
    this.table.classList.toggle("table-borderless", borderless)
    if (borderless) this.table.setAttribute("data-borderless", "true")
    else this.table.removeAttribute("data-borderless")
  }
}

const StyledTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      borderless: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-borderless") === "true",
        renderHTML: (attributes) => attributes.borderless ? { "data-borderless": "true", class: "table-borderless" } : {},
      },
    }
  },
  addNodeView() {
    return ({ node, view, HTMLAttributes }) => new StyledTableView(node, this.options.cellMinWidth, view, HTMLAttributes)
  },
})

export type TiptapEditorHandle = {
  insertField: (fieldKey: string, label: string) => void
}

// Конвертує {{field_1}} в <span data-field-key="field_1"> для Tiptap
function htmlWithFields(html: string): string {
  // Очищаємо markup, який міг зберегтися зі старої версії редактора.
  const cleaned = html.replace(/\{\{(\w+)\}\}"\s+contenteditable="false">([^<]*?),\s*\{\{\1\}\}/g, '<span data-field-key="$1" data-label="$2">$2</span>')
  const fields: string[] = []
  const protectedHtml = cleaned.replace(/<span\b[^>]*data-field-key=["']\w+["'][^>]*>[\s\S]*?<\/span>/gi, (field) => {
    fields.push(field)
    return `__FIELD_NODE_${fields.length - 1}__`
  })
  const withNewFields = protectedHtml.replace(/\{\{(\w+)\}\}/g, '<span data-field-key="$1" data-label="$1">$1</span>')
  return withNewFields.replace(/__FIELD_NODE_(\d+)__/g, (_, index: string) => fields[Number(index)] ?? "")
}

export const TiptapEditor = React.forwardRef<TiptapEditorHandle, Props>(function TiptapEditor({ content, onChange, placeholder, className, onFocus }, ref) {
  const [tableActive, setTableActive] = React.useState(false)
  const [borderlessTable, setBorderlessTable] = React.useState(false)
  const [tablePickerOpen, setTablePickerOpen] = React.useState(false)
  const [tableHover, setTableHover] = React.useState({ rows: 2, cols: 2 })
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ horizontalRule: false }),
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
      // Зберігаємо як HTML з {{field_1}} — для bodyTemplate/headerTemplate
      const html = editor.getHTML()
      // Конвертуємо field nodes назад в {{field_1}} (вже в HTML, але нормалізуємо)
      onChange(html)
      setTableActive(editor.isActive("table"))
      setBorderlessTable(editor.getAttributes("table").borderless === true)
    },
    onSelectionUpdate: ({ editor }) => {
      setTableActive(editor.isActive("table"))
      setBorderlessTable(editor.getAttributes("table").borderless === true)
    },
    editorProps: {
      attributes: {
        style: "font-family: 'Times New Roman', serif; font-size: 14px;",
        class: cn(
          "min-h-[180px] w-full p-3 text-sm leading-relaxed focus:outline-none",
          "prose prose-sm max-w-none dark:prose-invert",
          "[&_span[data-field-key]]:inline-flex [&_span[data-field-key]]:items-center [&_span[data-field-key]]:rounded [&_span[data-field-key]]:bg-amber-100 [&_span[data-field-key]]:px-1 [&_span[data-field-key]]:py-0.5 [&_span[data-field-key]]:text-xs [&_span[data-field-key]]:font-medium [&_span[data-field-key]]:text-amber-900 [&_span[data-field-key]]:ring-1 [&_span[data-field-key]]:ring-amber-200",
          className
        ),
      },
    },
  })
  const [fieldKey, setFieldKey] = React.useState("")
  const [fieldLabel, setFieldLabel] = React.useState("")

  React.useImperativeHandle(ref, () => ({
    insertField: (fieldKey, label) => editor?.chain().focus().insertContent({ type: "field", attrs: { fieldKey, label } }).run(),
  }), [editor])

  // Синхронізація коли content змінюється ззовні (наприклад переключення Tabs)
  React.useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    const next = htmlWithFields(content || "<p></p>")
    if (current !== next) {
      // Не ліземо якщо користувач редагує — тільки якщо зовнішня зміна
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

  return (
    <div className="overflow-hidden rounded-lg border bg-background" onFocus={onFocus}>
      {/* Простий тулбар — лише підказка, основна кнопка +Поле зовні */}
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
          defaultValue="14px"
          onChange={(event) => editor.chain().focus().setFontSize(event.target.value).run()}
          className="h-7 rounded border bg-background px-1.5 text-xs text-foreground"
          aria-label="Розмір шрифту"
        >
          {["10px", "11px", "12px", "14px", "16px", "18px", "20px", "24px"].map((size) => <option key={size}>{size}</option>)}
        </select>
        <div className="mx-1 h-5 w-px bg-border" />
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Жирний" onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="size-3.5" /></Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Курсив" onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="size-3.5" /></Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Підкреслений" onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="size-3.5" /></Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Ліворуч" onClick={() => editor.chain().focus().setTextAlign("left").run()}><AlignLeft className="size-3.5" /></Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="По центру" onClick={() => editor.chain().focus().setTextAlign("center").run()}><AlignCenter className="size-3.5" /></Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Праворуч" onClick={() => editor.chain().focus().setTextAlign("right").run()}><AlignRight className="size-3.5" /></Button>
        <Button type="button" size="icon-sm" variant="ghost" aria-label="По ширині" onClick={() => editor.chain().focus().setTextAlign("justify").run()}><AlignJustify className="size-3.5" /></Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <DropdownMenu open={tablePickerOpen} onOpenChange={setTablePickerOpen}>
          <DropdownMenuTrigger
            render={<Button type="button" size="icon-sm" variant="ghost" aria-label="Вставити таблицю" title="Вставити таблицю" />}
          >
            <Table2 className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-auto p-3">
            <div className="mb-2 text-xs font-medium text-foreground">Вставити таблицю</div>
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: "repeat(8, 18px)" }}
              onMouseLeave={() => setTableHover({ rows: 2, cols: 2 })}
            >
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
            <div className="mt-2 text-center text-xs text-muted-foreground">{tableHover.rows} × {tableHover.cols}</div>
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
         </div>
       </div>
       {tableActive && (
         <div className="flex flex-wrap items-center gap-1 border-b bg-sky-50/70 px-2 py-1.5 text-xs text-muted-foreground dark:bg-sky-950/20">
           <span className="mr-1 font-medium text-foreground">Таблиця</span>
           <DropdownMenu>
             <DropdownMenuTrigger render={<Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" />}>Рядок</DropdownMenuTrigger>
             <DropdownMenuContent align="start" className="min-w-44">
               <DropdownMenuGroup>
                 <DropdownMenuLabel>Керування рядками</DropdownMenuLabel>
                 <DropdownMenuItem onClick={() => editor.chain().focus().addRowBefore().run()}><Rows3 className="size-4" />Додати перед поточним</DropdownMenuItem>
                 <DropdownMenuItem onClick={() => editor.chain().focus().addRowAfter().run()}><Rows3 className="size-4" />Додати після поточного</DropdownMenuItem>
                 <DropdownMenuSeparator />
                 <DropdownMenuItem variant="destructive" onClick={() => editor.chain().focus().deleteRow().run()}><Trash2 className="size-4" />Видалити поточний</DropdownMenuItem>
               </DropdownMenuGroup>
             </DropdownMenuContent>
           </DropdownMenu>
           <DropdownMenu>
             <DropdownMenuTrigger render={<Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" />}>Стовпець</DropdownMenuTrigger>
             <DropdownMenuContent align="start" className="min-w-48">
               <DropdownMenuGroup>
                 <DropdownMenuLabel>Керування стовпцями</DropdownMenuLabel>
                 <DropdownMenuItem onClick={() => editor.chain().focus().addColumnBefore().run()}><Columns3 className="size-4" />Додати перед поточним</DropdownMenuItem>
                 <DropdownMenuItem onClick={() => editor.chain().focus().addColumnAfter().run()}><Columns3 className="size-4" />Додати після поточного</DropdownMenuItem>
                 <DropdownMenuSeparator />
                 <DropdownMenuItem variant="destructive" onClick={() => editor.chain().focus().deleteColumn().run()}><Trash2 className="size-4" />Видалити поточний</DropdownMenuItem>
               </DropdownMenuGroup>
             </DropdownMenuContent>
           </DropdownMenu>
           <div className="mx-1 h-5 w-px bg-border" />
           <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" disabled={!editor.can().mergeCells()} onClick={() => editor.chain().focus().mergeCells().run()}>
             Об’єднати
           </Button>
           <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" disabled={!editor.can().splitCell()} onClick={() => editor.chain().focus().splitCell().run()}>
             Розділити
           </Button>
           <Button type="button" size="sm" variant="outline" aria-pressed={borderlessTable} className={cn("h-7 gap-1 px-2 text-xs", borderlessTable && "border-dashed bg-sky-100/80 dark:bg-sky-900/40")} onClick={toggleTableBorderless}>
             {borderlessTable ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
             {borderlessTable ? "Межі: приховані" : "Межі: видимі"}
           </Button>
           <Button type="button" size="sm" variant="ghost" className="ml-auto h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive" onClick={() => editor.chain().focus().deleteTable().run()}>
             <Trash2 className="size-3.5" /> Видалити таблицю
           </Button>
         </div>
       )}
       <EditorContent editor={editor} />
    </div>
  )
})

// A4 превʼю — як у Word, Times New Roman, з заміною {{field_1}}
export function TiptapPreview({ html, data }: { html: string; data: Record<string, unknown> }) {
  const rendered = React.useMemo(() => {
    let out = html || ""
    out = out.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const v = data[key]
      if (v === undefined || v === null || v === "") return `<span class="rounded bg-amber-100 px-1 py-0.5 text-amber-900 ring-1 ring-amber-200">{{${key}}}</span>`
      return `<span class="rounded bg-amber-100 px-1 font-medium text-amber-900">${String(v)}</span>`
    })
    return out
  }, [html, data])

  return (
    <div className="mx-auto max-w-[720px] bg-white p-8 text-[13px] leading-relaxed text-zinc-900 shadow-sm ring-1 ring-black/5" style={{ fontFamily: "Times New Roman, serif" }}>
      {/* eslint-disable-next-line react/no-danger */}
       <div dangerouslySetInnerHTML={{ __html: rendered }} className="document-preview-content prose prose-sm max-w-none prose-p:my-2 prose-p:leading-relaxed" />
    </div>
  )
}
