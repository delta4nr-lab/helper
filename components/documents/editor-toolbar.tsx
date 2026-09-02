"use client"

import type { Editor } from "@tiptap/react"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Table,
  Underline as UnderlineIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"

type Props = {
  editor: Editor
}

// Панель інструментів редактора: форматування, вирівнювання, таблиці.
// Тільки UI — викликає Tiptap commands напряму.
export function EditorToolbar({ editor }: Props) {
  return (
    <div className="no-print flex flex-wrap items-center gap-1 rounded-lg border bg-background p-1.5">
      <Button type="button" variant={editor.isActive("bold") ? "default" : "ghost"} size="icon-sm" onClick={() => editor.chain().focus().toggleBold().run()} title="Жирний">
        <Bold className="size-4" />
      </Button>
      <Button type="button" variant={editor.isActive("italic") ? "default" : "ghost"} size="icon-sm" onClick={() => editor.chain().focus().toggleItalic().run()} title="Курсив">
        <Italic className="size-4" />
      </Button>
      <Button type="button" variant={editor.isActive("underline") ? "default" : "ghost"} size="icon-sm" onClick={() => editor.chain().focus().toggleUnderline().run()} title="Підкреслений">
        <UnderlineIcon className="size-4" />
      </Button>

      <div className="mx-1 h-5 w-px bg-border" />

      <Button type="button" variant={editor.isActive({ textAlign: "left" }) ? "default" : "ghost"} size="icon-sm" onClick={() => editor.chain().focus().setTextAlign("left").run()} title="Вліво">
        <AlignLeft className="size-4" />
      </Button>
      <Button type="button" variant={editor.isActive({ textAlign: "center" }) ? "default" : "ghost"} size="icon-sm" onClick={() => editor.chain().focus().setTextAlign("center").run()} title="По центру">
        <AlignCenter className="size-4" />
      </Button>
      <Button type="button" variant={editor.isActive({ textAlign: "right" }) ? "default" : "ghost"} size="icon-sm" onClick={() => editor.chain().focus().setTextAlign("right").run()} title="Вправо">
        <AlignRight className="size-4" />
      </Button>
      <Button type="button" variant={editor.isActive({ textAlign: "justify" }) ? "default" : "ghost"} size="icon-sm" onClick={() => editor.chain().focus().setTextAlign("justify").run()} title="По ширині">
        <AlignJustify className="size-4" />
      </Button>

      <div className="mx-1 h-5 w-px bg-border" />

      <Button type="button" variant="ghost" size="icon-sm" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Додати таблицю 3×3">
        <Table className="size-4" />
      </Button>
    </div>
  )
}