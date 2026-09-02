"use client"

import { ImagePlus, Loader2, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { PageSettings } from "@/lib/documents/page"
import { PageSettingsDialog } from "@/components/documents/page-settings-dialog"
import { ImagePicker, type PickedImage } from "@/components/documents/image-picker"

type Props = {
  title: string
  page: PageSettings
  defaultPage: PageSettings
  pending: boolean
  message: { ok: boolean; message: string } | null
  pageDialogOpen: boolean
  setPageDialogOpen: (open: boolean) => void
  imagePickerOpen: boolean
  setImagePickerOpen: (open: boolean) => void
  onApplyPage: (next: PageSettings) => void
  onResetPage: () => void
  onInsertImage: (image: PickedImage) => void
  onExport: () => void
}

// Верхня панель редактора: заголовок, кнопки та діалоги (сторінка, зображення, експорт).
export function EditorHeader({
  title,
  page,
  defaultPage,
  pending,
  message,
  pageDialogOpen,
  setPageDialogOpen,
  imagePickerOpen,
  setImagePickerOpen,
  onApplyPage,
  onResetPage,
  onInsertImage,
  onExport,
}: Props) {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{page.orientation === "landscape" ? "А4 альбом" : "A4 · книжкова"}</p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          {message && (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                message.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30" : "bg-destructive/10 text-destructive"
              }`}
            >
              {message.message}
            </p>
          )}
          <Button type="button" variant="outline" onClick={() => setPageDialogOpen(true)} className="cursor-pointer">
            Сторінка
          </Button>
          <Button type="button" variant="outline" onClick={() => setImagePickerOpen(true)} className="cursor-pointer" title="Додати зображення">
            <ImagePlus className="size-4" /> Зображення
          </Button>
          <Button type="button" disabled={pending} onClick={onExport} className="cursor-pointer">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Експортувати DOCX
          </Button>
        </div>
      </div>

      <PageSettingsDialog
        open={pageDialogOpen}
        onOpenChange={setPageDialogOpen}
        page={page}
        defaultPage={defaultPage}
        onApply={onApplyPage}
        onReset={onResetPage}
      />

      <ImagePicker open={imagePickerOpen} onOpenChange={setImagePickerOpen} onInsert={onInsertImage} />
    </>
  )
}