"use client"

import { Heading1, Heading2, Bold, Italic, Underline, Strikethrough, List, Undo2, Redo2 } from "lucide-react"

import type { Editor } from "@tiptap/react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

type Props = {
  editor: Editor | null
}

export function FloatingToolbar({ editor }: Props) {
  if (!editor) return null

  return (
    <div className="sticky top-14 z-40 -mx-4 border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 sm:-mx-6 lg:-mx-8">
      <div className="mx-auto flex max-w-[1280px] items-center gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">
        {/* Undo / Redo */}
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Скасувати (Ctrl+Z)">
            <Undo2 className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Повторити (Ctrl+Shift+Z)">
            <Redo2 className="size-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="mx-1 h-5 shrink-0" />

        {/* Headings */}
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" variant={editor.isActive("heading", { level: 1 }) ? "secondary" : "ghost"} size="icon-sm" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Заголовок 1">
            <Heading1 className="size-4" />
          </Button>
          <Button type="button" variant={editor.isActive("heading", { level: 2 }) ? "secondary" : "ghost"} size="icon-sm" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Заголовок 2">
            <Heading2 className="size-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="mx-1 h-5 shrink-0" />

        {/* Formatting */}
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" variant={editor.isActive("bold") ? "secondary" : "ghost"} size="icon-sm" onClick={() => editor.chain().focus().toggleBold().run()} title="Жирний">
            <Bold className="size-4" />
          </Button>
          <Button type="button" variant={editor.isActive("italic") ? "secondary" : "ghost"} size="icon-sm" onClick={() => editor.chain().focus().toggleItalic().run()} title="Курсив">
            <Italic className="size-4" />
          </Button>
          <Button type="button" variant={editor.isActive("underline") ? "secondary" : "ghost"} size="icon-sm" onClick={() => editor.chain().focus().toggleUnderline().run()} title="Підкреслений">
            <Underline className="size-4" />
          </Button>
          <Button type="button" variant={editor.isActive("strike") ? "secondary" : "ghost"} size="icon-sm" onClick={() => editor.chain().focus().toggleStrike().run()} title="Закреслений">
            <Strikethrough className="size-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="mx-1 h-5 shrink-0" />

        {/* Lists */}
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" variant={editor.isActive("bulletList") ? "secondary" : "ghost"} size="icon-sm" onClick={() => editor.chain().focus().toggleBulletList().run()} title="Маркований список">
            <List className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}