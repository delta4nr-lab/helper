"use client"

import * as React from "react"
import { Download, FileWarning, Loader2 } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type PreviewStatus = "loading" | "ready" | "error"

type AnchorPosition = {
  relativeH: string | null
  offsetH: number | null
  alignH: string | null
  relativeV: string | null
  offsetV: number | null
  alignV: string | null
}

const EMU_PER_PX = 9525

// docx-preview ігнорує relativeFrom і ставить плаваючі зображення (0×0-обгортки)
// відносно місця в абзаці. Горизонталь для підписів (relativeH="page") беремо
// як у редакторі — правий край на лівому краї поля-якоря. Вертикаль — за
// семантикою OOXML: page — від сторінки, margin — від поля, paragraph/column —
// від абзацу.
function resolveAxis(
  relative: string | null,
  offsetEmu: number | null,
  sectionStart: number,
  marginStart: number,
  paragraphStart: number
): number | null {
  if (offsetEmu == null) return null
  const offset = offsetEmu / EMU_PER_PX
  switch (relative) {
    case "margin":
      return marginStart + offset
    case "column":
    case "paragraph":
      return paragraphStart + offset
    case "page":
    default:
      return sectionStart + offset
  }
}

function applyAnchorLayout(container: HTMLElement, anchors: AnchorPosition[]) {
  if (anchors.length === 0) return

  const wrappers = Array.from(
    container.querySelectorAll<HTMLElement>(
      'div[style*="width: 0px"][style*="height: 0px"]'
    )
  )

  wrappers.forEach((wrapper, index) => {
    const anchor = anchors[index]
    if (!anchor) return

    const section = wrapper.closest<HTMLElement>("section.docx")
    if (!section) return
    const paragraph = wrapper.closest<HTMLElement>("p")

    const wrapperRect = wrapper.getBoundingClientRect()
    const sectionRect = section.getBoundingClientRect()
    const sectionStyle = getComputedStyle(section)
    const paragraphRect = paragraph?.getBoundingClientRect() ?? sectionRect
    const paragraphStyle = paragraph ? getComputedStyle(paragraph) : null

    const padLeft = parseFloat(sectionStyle.paddingLeft) || 0
    const padTop = parseFloat(sectionStyle.paddingTop) || 0
    const pPadLeft = paragraphStyle ? parseFloat(paragraphStyle.paddingLeft) || 0 : 0
    const pPadTop = paragraphStyle ? parseFloat(paragraphStyle.paddingTop) || 0 : 0

    const wrapperStyle = getComputedStyle(wrapper)
    const currentLeft = parseFloat(wrapperStyle.left) || 0
    const currentTop = parseFloat(wrapperStyle.top) || 0
    const normalLeft = wrapperRect.left - currentLeft
    const normalTop = wrapperRect.top - currentTop

    const targetTop = resolveAxis(
      anchor.relativeV,
      anchor.offsetV,
      sectionRect.top,
      sectionRect.top + padTop,
      paragraphRect.top + pPadTop
    )

    // Підпис: як у редакторі — правий край зображення притиснутий до лівого
    // краю поля-якоря (зображення ЛІВОРУЧ від нього), а не page-relative зсув
    // редактора, який не збігається з табуляцією docx-preview.
    const image = wrapper.querySelector<HTMLElement>("img")
    const imageWidth = image?.getBoundingClientRect().width ?? 0
    if (anchor.relativeH === "page" && imageWidth > 0) {
      wrapper.style.left = `${-imageWidth}px`
    } else {
      const targetLeft = resolveAxis(
        anchor.relativeH,
        anchor.offsetH,
        sectionRect.left,
        sectionRect.left + padLeft,
        paragraphRect.left + pPadLeft
      )
      if (targetLeft != null) {
        wrapper.style.left = `${targetLeft - normalLeft}px`
      }
    }

    if (targetTop != null) {
      wrapper.style.top = `${targetTop - normalTop}px`
    }
    // behindDoc=0 → зображення «перед текстом».
    wrapper.style.zIndex = "2"
  })
}

// Тіло діалогу монтується заново на кожен документ (key у батька), тому
// початковий стан завжди "loading" і setState у ефекті відбувається лише
// в асинхронних колбеках.
function PreviewBody({ documentId }: { documentId: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [status, setStatus] = React.useState<PreviewStatus>("loading")

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    container.replaceChildren()

    void (async () => {
      try {
        const [docxResponse, anchorsResponse] = await Promise.all([
          fetch(`/api/exports/${documentId}?inline=1`),
          fetch(`/api/exports/${documentId}?anchors=1`),
        ])
        if (!docxResponse.ok) throw new Error(`HTTP ${docxResponse.status}`)
        const buffer = await docxResponse.arrayBuffer()

        let anchors: AnchorPosition[] = []
        if (anchorsResponse.ok) {
          try {
            const payload = (await anchorsResponse.json()) as {
              anchors?: AnchorPosition[]
            }
            anchors = payload.anchors ?? []
          } catch {
            anchors = []
          }
        }

        const { renderAsync } = await import("docx-preview")
        if (cancelled) return
        await renderAsync(buffer, container, undefined, {
          inWrapper: true,
          breakPages: true,
          useBase64URL: true,
        })
        if (cancelled) return

        const wrapper = container.querySelector<HTMLElement>(".docx-wrapper")
        if (wrapper) {
          wrapper.style.background = "transparent"
          wrapper.style.padding = "0"
        }

        applyAnchorLayout(container, anchors)

        setStatus("ready")
      } catch (error) {
        console.warn("[document-preview] не вдалося відрендерити DOCX", error)
        if (!cancelled) setStatus("error")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [documentId])

  if (status === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-[#3b3f45] p-6 text-center text-sm text-zinc-300">
        <FileWarning className="size-6" />
        Не вдалося відобразити документ.
      </div>
    )
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-auto bg-[#3b3f45] p-4 sm:p-6">
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-zinc-300">
          <Loader2 className="size-4 animate-spin" />
          Завантаження документа…
        </div>
      )}
      <div ref={containerRef} className="mx-auto w-full" />
    </div>
  )
}

export function DocumentPreviewDialog({
  document,
  open,
  onOpenChange,
}: {
  document: { id: string; title: string } | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="truncate pr-8">
            {document?.title ?? "Документ"}
          </DialogTitle>
          <DialogDescription>
            Попередній перегляд DOCX. Для збереження скористайтеся кнопкою
            «Завантажити».
          </DialogDescription>
        </DialogHeader>

        {document && open ? (
          <PreviewBody key={document.id} documentId={document.id} />
        ) : (
          <div className="flex-1" />
        )}

        <DialogFooter className="mx-0 mb-0 items-center border-t px-4 py-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Закрити
          </Button>
          {document && (
            <a
              href={`/api/exports/${document.id}`}
              className={cn(buttonVariants())}
            >
              <Download className="size-4" />
              Завантажити
            </a>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
