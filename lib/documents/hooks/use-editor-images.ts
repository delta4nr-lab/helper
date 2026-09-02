"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { NodeSelection } from "@tiptap/pm/state"

import type { PickedImage } from "@/components/documents/image-picker"
import type { ImageAlignment, SelectedImage } from "@/components/documents/types"
import { usableMm, type PageSettings } from "@/lib/documents/page"

type Options = {
  editor: Editor | null
  page: PageSettings
  openImagePicker: (open: boolean) => void
}

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"]
const MAX_SIZE = 10 * 1024 * 1024

// Відповідає за business logic зображень в editor:
// вставка, upload, розміри (mm), вирівнювання, заміна, видалення, панель обраного зображення.
export function useEditorImages({ editor, page, openImagePicker }: Options) {
  const [selectedImage, setSelectedImage] = React.useState<SelectedImage | null>(null)
  const [replacePos, setReplacePos] = React.useState<number | null>(null)
  const [keepAspect, setKeepAspect] = React.useState(true)
  const uploadImageRef = React.useRef<(file: File) => void>(() => {})

  // Автоматичний початковий розмір зображення (mm): по ширині робочої області,
  // маленькі не збільшуємо (scale ≤ 1). Aspect ratio зберігається.
  const computeInitialImageSize = React.useCallback(
    (imgWidthPx: number, imgHeightPx: number): { widthMm: number; heightMm: number } => {
      const natW = (imgWidthPx / 96) * 25.4
      const natH = (imgHeightPx / 96) * 25.4
      if (natW <= 0 || natH <= 0) return { widthMm: 80, heightMm: 60 }
      const available = usableMm(page)
      const scale = Math.min(available.width / natW, 1)
      return { widthMm: natW * scale, heightMm: natH * scale }
    },
    [page]
  )

  const insertImage = React.useCallback(
    (image: PickedImage) => {
      if (!editor) return
      const size = computeInitialImageSize(image.width, image.height)
      const endPos = editor.state.doc.content.size
      const html = `<img src="${image.path}" data-image-id="${image.id}" data-width-mm="${size.widthMm}" data-height-mm="${size.heightMm}" data-align="center" data-page-break="true"><p></p>`
      const prev = editor.state.doc
      editor.chain().focus().insertContentAt(endPos, html).run()
      const next = editor.state.doc
      if (next === prev) {
        // fallback: вставити node напряму
        const node = editor.schema.nodes.image.create({
          imageId: image.id,
          src: image.path,
          widthMm: size.widthMm,
          heightMm: size.heightMm,
          align: "center",
          pageBreakBefore: true,
        })
        editor.chain().focus().insertContentAt(endPos, node).run()
      }
    },
    [editor, computeInitialImageSize]
  )

  // Обробка вставки: якщо є replacePos — замінюємо обране зображення, інакше додаємо нове.
  function handleImageInsert(image: PickedImage) {
    if (replacePos != null && editor) {
      const node = editor.state.doc.nodeAt(replacePos)
      const curW = Number(node?.attrs?.widthMm) || 0
      const nextW = curW > 0 ? curW : computeInitialImageSize(image.width, image.height).widthMm
      const nextH = image.width > 0 ? (nextW * image.height) / image.width : computeInitialImageSize(image.width, image.height).heightMm
      editor.chain().focus().setNodeSelection(replacePos).updateAttributes("image", {
        imageId: image.id,
        src: image.path,
        widthMm: Math.round(nextW * 10) / 10,
        heightMm: Math.round(nextH * 10) / 10,
      }).run()
      setReplacePos(null)
      return
    }
    insertImage(image)
  }

  const uploadAndInsertImage = React.useCallback(
    async (file: File) => {
      if (!ALLOWED_MIME.includes(file.type)) return
      if (file.size > MAX_SIZE) return
      const form = new FormData()
      form.append("file", file)
      try {
        const res = await fetch("/api/images/upload", { method: "POST", body: form })
        const data = (await res.json()) as { message?: string; id?: string; path?: string; width?: number; height?: number }
        if (!res.ok || !data.id || !data.path) return
        insertImage({ id: data.id, path: data.path, width: data.width ?? 0, height: data.height ?? 0, originalFilename: file.name })
      } catch {
        // upload failed — ігноруємо
      }
    },
    [insertImage]
  )

  React.useEffect(() => {
    uploadImageRef.current = uploadAndInsertImage
  }, [uploadAndInsertImage])

  function updateSelectedImage(patch: Record<string, unknown>) {
    if (!editor || !selectedImage) return
    editor.chain().focus().setNodeSelection(selectedImage.pos).updateAttributes("image", patch).run()
  }

  function changeImageSize(side: "width" | "height", value: number) {
    if (!editor || !selectedImage) return
    const w = Number(selectedImage.attrs.widthMm) || 0
    const h = Number(selectedImage.attrs.heightMm) || 0
    const aspect = w > 0 && h > 0 ? w / h : 1
    const clamped = Math.max(5, value)
    if (side === "width") {
      updateSelectedImage({ widthMm: clamped, heightMm: keepAspect ? Math.round((clamped / aspect) * 10) / 10 : h })
    } else {
      updateSelectedImage({ heightMm: clamped, widthMm: keepAspect ? Math.round((clamped * aspect) * 10) / 10 : w })
    }
  }

  function changeImageAlign(align: ImageAlignment) {
    updateSelectedImage({ align })
  }

  function deleteSelectedImage() {
    if (!editor || !selectedImage) return
    editor.chain().focus().setNodeSelection(selectedImage.pos).deleteSelection().run()
    setSelectedImage(null)
  }

  function replaceSelectedImage() {
    if (!selectedImage) return
    setReplacePos(selectedImage.pos)
    openImagePicker(true)
  }

  // Обробка зміни selection: якщо обрано image-вузол — показуємо панель редагування.
  function handleSelectionChange(ed: Editor) {
    const sel = ed.state.selection
    if (sel instanceof NodeSelection && sel.node.type.name === "image") {
      const coords = ed.view.coordsAtPos(sel.from)
      setSelectedImage({
        pos: sel.from,
        attrs: { ...sel.node.attrs },
        x: coords.left,
        y: coords.top,
      })
    } else {
      setSelectedImage((prev) => (prev ? null : prev))
    }
  }

  return {
    selectedImage,
    keepAspect,
    setKeepAspect,
    uploadImageRef,
    handleImageInsert,
    handleSelectionChange,
    changeImageSize,
    changeImageAlign,
    deleteSelectedImage,
    replaceSelectedImage,
  }
}