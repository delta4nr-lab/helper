"use client"

import * as React from "react"
import { useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import TextAlign from "@tiptap/extension-text-align"
import Placeholder from "@tiptap/extension-placeholder"
import { TableKitPlus } from "tiptap-table-plus"
import { PaginationPlus } from "tiptap-pagination-plus"

import { PaginationHistoryGuard } from "@/lib/documents/editor/history-guard"
import { ImageNode } from "@/lib/documents/editor/image-extension"
import { FillMark } from "@/lib/documents/editor/fill-mark"
import { SignatureImageNode } from "@/lib/documents/editor/signature-image"
import { marginsPx } from "@/lib/documents/page"

import { usePageSettings } from "@/lib/documents/hooks/use-page-settings"
import { usePersonFields, MENU_LABELS } from "@/lib/documents/hooks/use-person-fields"
import { useEditorImages } from "@/lib/documents/hooks/use-editor-images"

import { EditorHeader } from "@/components/documents/editor-header"
import { EditorWorkspace } from "@/components/documents/editor-workspace"
import { FloatingToolbar } from "@/components/documents/floating-toolbar"
import { ImageControls } from "@/components/documents/image-controls"
import type { Personnel } from "@/components/documents/types"

type Props = {
  templateId: string
  title: string
  paper?: string | null
  content?: string | null
  personnel: Personnel[]
}

// Оркестратор редактора: створює editor, підключає hooks і збирає UI.
export function DocumentEditor({ templateId, title, paper, content, personnel }: Props) {
  const [pageDialogOpen, setPageDialogOpen] = React.useState(false)
  const [imagePickerOpen, setImagePickerOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<{ ok: boolean; message: string } | null>(null)

  const { page, fallbackPage, pagePx, applyPageSettings, resetPageSettings } = usePageSettings(templateId, paper)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ horizontalRule: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "Почніть писати..." }),
      FillMark,
      SignatureImageNode,
      ImageNode,
      TableKitPlus,
      PaginationHistoryGuard,
      PaginationPlus.configure({
        pageHeight: pagePx.height,
        pageWidth: pagePx.width,
        pageGap: 20,
        pageGapBorderSize: 1,
        pageGapBorderColor: "#e5e5e5",
        pageBreakBackground: "rgb(59, 63, 69)",
        marginTop: marginsPx(page).top,
        marginBottom: marginsPx(page).bottom,
        marginLeft: marginsPx(page).left,
        marginRight: marginsPx(page).right,
        contentMarginTop: 30,
        contentMarginBottom: 30,
      }),
    ],
    content: content ?? "<p></p>",
    editorProps: {
      attributes: {
        class: "document-editor prose prose-sm max-w-none focus:outline-none",
      },
      handleDrop: (view, event) => {
        const imageFile = Array.from(event.dataTransfer?.files ?? []).find((f) => f.type.startsWith("image/"))
        if (imageFile) {
          event.preventDefault()
          uploadImageRef.current(imageFile)
          return true
        }
        return false
      },
      handlePaste: (view, event) => {
        const imageFile = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"))
        if (imageFile) {
          event.preventDefault()
          uploadImageRef.current(imageFile)
          return true
        }
        return false
      },
    },
    onSelectionUpdate: ({ editor }) => {
      handleFieldSelection(editor)
      handleSelectionChange(editor)
    },
  })

  const personFields = usePersonFields({ editor, personnel })
  const images = useEditorImages({ editor, page, openImagePicker: setImagePickerOpen })
  const { uploadImageRef, handleSelectionChange } = images
  const { handleFieldSelection } = personFields

  // Синхронізація налаштувань сторінки з PaginationPlus
  React.useEffect(() => {
    if (!editor) return
    const m = marginsPx(page)
    editor
      .chain()
      .updatePageSize({ pageWidth: pagePx.width, pageHeight: pagePx.height, marginTop: m.top, marginBottom: m.bottom, marginLeft: m.left, marginRight: m.right })
      .updateMargins({ top: m.top, bottom: m.bottom, left: m.left, right: m.right })
      .run()
  }, [page, pagePx, editor])

  async function onExport() {
    if (!editor) return
    setPending(true)
    setMessage(null)
    try {
      const html = editor.getHTML()
      const response = await fetch(`/api/templates/${templateId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html, page }),
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

  if (!editor) return null

  return (
    <div className="relative space-y-4">
      <EditorHeader
        title={title}
        page={page}
        defaultPage={fallbackPage}
        pending={pending}
        message={message}
        pageDialogOpen={pageDialogOpen}
        setPageDialogOpen={setPageDialogOpen}
        imagePickerOpen={imagePickerOpen}
        setImagePickerOpen={setImagePickerOpen}
        onApplyPage={applyPageSettings}
        onResetPage={resetPageSettings}
        onInsertImage={images.handleImageInsert}
        onExport={onExport}
      />

      <FloatingToolbar editor={editor} />

      <EditorWorkspace
        editor={editor}
        pageWidth={pagePx.width}
        contentWrapRef={personFields.contentWrapRef}
        triggerWrapRef={personFields.triggerWrapRef}
        mouseDownRef={personFields.mouseDownRef}
        fieldRectRef={personFields.fieldRectRef}
        menuOpen={personFields.menuOpen}
        setMenuOpen={personFields.setMenuOpen}
        pickerTarget={personFields.pickerTarget}
        setPickerTarget={personFields.setPickerTarget}
        menuLabel={personFields.pickerTarget ? (MENU_LABELS[personFields.pickerTarget.type] ?? "Шаблони") : ""}
        pickablePersons={personFields.pickablePersons}
        triggerText={personFields.triggerText}
        onSelectPerson={personFields.applyPerson}
        onClearGroup={personFields.clearGroup}
        onClearSignature={personFields.clearSignature}
        findPickerTarget={personFields.findPickerTarget}
      />

      {images.selectedImage && (
        <div
          className="fixed z-40"
          style={{ left: images.selectedImage.x, top: images.selectedImage.y, transform: "translate(-50%, calc(-100% - 10px))" }}
        >
          <ImageControls
            selectedImage={images.selectedImage}
            keepAspect={images.keepAspect}
            onKeepAspectChange={images.setKeepAspect}
            onSizeChange={images.changeImageSize}
            onAlignChange={images.changeImageAlign}
            onReplace={images.replaceSelectedImage}
            onDelete={images.deleteSelectedImage}
          />
        </div>
      )}
    </div>
  )
}