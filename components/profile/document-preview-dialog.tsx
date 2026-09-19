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
        const response = await fetch(`/api/exports/${documentId}?inline=1`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const buffer = await response.arrayBuffer()
        const { renderAsync } = await import("docx-preview")
        if (cancelled) return
        await renderAsync(buffer, container, undefined, {
          inWrapper: true,
          breakPages: true,
          useBase64URL: true,
          ignoreWidth: true,
        })
        if (cancelled) return

        const wrapper = container.querySelector<HTMLElement>(".docx-wrapper")
        if (wrapper) {
          wrapper.style.background = "transparent"
          wrapper.style.padding = "0"
        }
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
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
        <FileWarning className="size-6" />
        Не вдалося відобразити документ.
      </div>
    )
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-auto bg-muted/30 p-4">
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
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
      <DialogContent className="flex h-[85vh] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
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
