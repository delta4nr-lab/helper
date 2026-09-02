"use client"

import { Node, mergeAttributes } from "@tiptap/core"
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"
import type { NodeViewProps } from "@tiptap/react"
import * as React from "react"
import { mmToPx } from "@/lib/documents/page"

type ImageAttrs = {
  imageId: string | null
  src: string
  widthMm: number
  heightMm: number
  align: "left" | "center" | "right"
}

const HANDLES = ["nw", "ne", "sw", "se"] as const
type Handle = (typeof HANDLES)[number]

function ImageNodeView({ node, updateAttributes, selected }: NodeViewProps) {
  const attrs = node.attrs as ImageAttrs & { pageBreakBefore?: boolean }
  const widthPx = mmToPx(attrs.widthMm)
  const heightPx = mmToPx(attrs.heightMm)
  const aspect = attrs.widthMm > 0 && attrs.heightMm > 0 ? attrs.widthMm / attrs.heightMm : 1

  function startResize(event: React.PointerEvent, corner: Handle) {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startW = attrs.widthMm

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / mmToPx(1)
      let newW = corner === "se" || corner === "ne" ? startW + dx : startW - dx
      newW = Math.max(10, newW)
      const newH = newW / aspect
      updateAttributes({ widthMm: Math.round(newW * 10) / 10, heightMm: Math.round(newH * 10) / 10 })
    }
    const onUp = () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
  }

  return (
    <NodeViewWrapper className={`doc-image-align-${attrs.align}`} as="div" contentEditable={false}>
      <div
        className="doc-image-node"
        data-selected={selected || undefined}
        data-page-break={attrs.pageBreakBefore ? "true" : undefined}
        style={attrs.pageBreakBefore ? { breakBefore: "page" } : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={attrs.src} alt="" width={widthPx} height={heightPx} />
        {selected &&
          HANDLES.map((handle) => (
            <span
              key={handle}
              className={`doc-image-handle doc-image-handle--${handle}`}
              onPointerDown={(e) => startResize(e, handle)}
            />
          ))}
      </div>
    </NodeViewWrapper>
  )
}

// Зображення документа. Зберігає посилання на файл (src) + imageId + фізичні розміри (mm) + вирівнювання.
export const ImageNode = Node.create({
  name: "image",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      imageId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-image-id"),
        renderHTML: (attrs) => (attrs.imageId ? { "data-image-id": attrs.imageId } : {}),
      },
      src: {
        default: null,
        parseHTML: (el) => el.getAttribute("src"),
        renderHTML: (attrs) => ({ src: attrs.src }),
      },
      widthMm: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute("data-width-mm")) || 0,
        renderHTML: (attrs) => (attrs.widthMm ? { "data-width-mm": String(attrs.widthMm) } : {}),
      },
      heightMm: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute("data-height-mm")) || 0,
        renderHTML: (attrs) => (attrs.heightMm ? { "data-height-mm": String(attrs.heightMm) } : {}),
      },
      align: {
        default: "left",
        parseHTML: (el) => el.getAttribute("data-align") || "left",
        renderHTML: (attrs) => (attrs.align ? { "data-align": attrs.align } : {}),
      },
      pageBreakBefore: {
        default: false,
        parseHTML: (el) => el.getAttribute("data-page-break") === "true",
        renderHTML: (attrs) => (attrs.pageBreakBefore ? { "data-page-break": "true", style: "page-break-before: always" } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'img[src^="/uploads/"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes, { class: "doc-image" })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView)
  },
})