"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Check, ImagePlus, Loader2, Search, Trash2, UploadCloud } from "lucide-react"
import { cn } from "@/lib/utils"

export type PickedImage = {
  id: string
  path: string
  width: number
  height: number
  originalFilename: string
}

type ImageRecord = {
  id: string
  filename: string
  originalFilename: string
  path: string
  mimeType: string
  size: number
  width: number
  height: number
  createdAt: string
}

type ImagePickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInsert: (image: PickedImage) => void
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_SIZE = 10 * 1024 * 1024

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / (1024 * 1024)).toFixed(2)} МБ`
}

// Вміст діалогу. Монтується при відкритті — стан скидається автоматично.
function ImagePickerContent({ onInsert, onClose }: { onInsert: (image: PickedImage) => void; onClose: () => void }) {
  const [tab, setTab] = React.useState("upload")

  // Upload
  const [dragActive, setDragActive] = React.useState(false)
  const [file, setFile] = React.useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [uploadError, setUploadError] = React.useState<string | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [progress, setProgress] = React.useState(0)

  // Library
  const [query, setQuery] = React.useState("")
  const [images, setImages] = React.useState<ImageRecord[]>([])
  const [libraryLoading, setLibraryLoading] = React.useState(false)
  const [libraryError, setLibraryError] = React.useState<string | null>(null)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const searchTimerRef = React.useRef<number | null>(null)

  function loadLibrary(nextQuery: string) {
    setLibraryLoading(true)
    setLibraryError(null)
    const params = new URLSearchParams({ pageSize: "100" })
    if (nextQuery.trim()) params.set("q", nextQuery.trim())
    fetch(`/api/images?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error()
        return (await res.json()) as { images: ImageRecord[] }
      })
      .then((data) => setImages(data.images))
      .catch(() => setLibraryError("Не вдалося завантажити бібліотеку зображень."))
      .finally(() => setLibraryLoading(false))
  }

  function handleSearchChange(next: string) {
    setQuery(next)
    if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current)
    searchTimerRef.current = window.setTimeout(() => loadLibrary(next), 300)
  }

  React.useEffect(() => {
    return () => {
      if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current)
    }
  }, [])

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function validateFile(next: File): string | null {
    if (!ALLOWED_TYPES.includes(next.type)) return "Дозволені лише JPG, PNG, WEBP."
    if (next.size > MAX_SIZE) return "Файл завеликий (максимум 10 МБ)."
    return null
  }

  function handleFile(next: File | null) {
    if (!next) return
    const error = validateFile(next)
    setUploadError(error)
    if (error) {
      setFile(null)
      setPreviewUrl(null)
      return
    }
    setFile(next)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(next))
    setProgress(0)
  }

  function upload() {
    if (!file) return
    setUploading(true)
    setUploadError(null)
    setProgress(0)

    const form = new FormData()
    form.append("file", file)
    const xhr = new XMLHttpRequest()
    xhr.open("POST", "/api/images/upload")
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      setUploading(false)
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText) as { id: string; path: string; width: number; height: number }
        onInsert({
          id: data.id,
          path: data.path,
          width: data.width,
          height: data.height,
          originalFilename: file.name,
        })
        onClose()
      } else {
        let message = "Не вдалося завантажити зображення."
        try {
          const body = JSON.parse(xhr.responseText) as { message?: string }
          if (body.message) message = body.message
        } catch {}
        setUploadError(message)
      }
    }
    xhr.onerror = () => {
      setUploading(false)
      setUploadError("Не вдалося підключитися до сервера. Спробуйте ще раз.")
    }
    xhr.send(form)
  }

  function insertSelected() {
    const image = images.find((i) => i.id === selectedId)
    if (!image) return
    onInsert({ id: image.id, path: image.path, width: image.width, height: image.height, originalFilename: image.originalFilename })
    onClose()
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Додати зображення</DialogTitle>
      </DialogHeader>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = v === "library" ? "library" : "upload"
          setTab(next)
          if (next === "library") loadLibrary(query)
        }}
      >
        <TabsList className="w-full">
          <TabsTrigger value="upload" className="flex-1">
            <UploadCloud className="size-4" /> Завантажити
          </TabsTrigger>
          <TabsTrigger value="library" className="flex-1">
            <ImagePlus className="size-4" /> Мої зображення
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-3">
          {!file ? (
            <label
              onDragOver={(e) => {
                e.preventDefault()
                setDragActive(true)
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragActive(false)
                handleFile(e.dataTransfer.files?.[0] ?? null)
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors",
                dragActive ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
              )}
            >
              <UploadCloud className="size-10 text-muted-foreground" />
              <span className="text-sm font-medium">Перетягніть зображення сюди</span>
              <span className="text-xs text-muted-foreground">або натисніть, щоб вибрати файл</span>
              <span className="mt-1 text-xs text-muted-foreground">JPG, PNG, WEBP • до 10 МБ</span>
              <input type="file" accept=".jpg,.jpeg,.png,.webp" className="sr-only" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
            </label>
          ) : (
            <div className="grid gap-3">
              {previewUrl && (
                <div className="flex max-h-56 items-center justify-center overflow-hidden rounded-lg border bg-muted/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Попередній перегляд" className="max-h-56 object-contain" />
                </div>
              )}
              <div className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                </div>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => { setFile(null); setPreviewUrl(null) }} title="Скасувати вибір">
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
              {uploading && (
                <div className="grid gap-1.5">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">Завантаження... {progress}%</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="library" className="mt-3">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Пошук зображень..."
              className="pl-8"
            />
          </div>

          {libraryLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Завантаження...
            </div>
          ) : libraryError ? (
            <p className="py-10 text-center text-sm text-destructive">{libraryError}</p>
          ) : images.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Зображень немає. Завантажте перше.</p>
          ) : (
            <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
              {images.map((img) => {
                const selected = img.id === selectedId
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setSelectedId(selected ? null : img.id)}
                    className={cn(
                      "group relative aspect-square cursor-pointer overflow-hidden rounded-md border bg-muted/40 outline-none transition-colors hover:border-ring",
                      selected && "border-primary ring-2 ring-ring/50"
                    )}
                    title={`${img.originalFilename}\n${img.width} × ${img.height}px`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.path} alt={img.originalFilename} className="h-full w-full object-contain p-1" loading="lazy" />
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-black/50 px-1 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {img.originalFilename}
                    </span>
                    {selected && (
                      <span className="pointer-events-none absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Скасувати
        </Button>
        {tab === "upload" && file && (
          <Button type="button" onClick={upload} disabled={uploading}>
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
            Завантажити
          </Button>
        )}
        {tab === "library" && (
          <Button type="button" onClick={insertSelected} disabled={!selectedId}>
            Вставити
          </Button>
        )}
      </DialogFooter>
    </>
  )
}

export function ImagePicker({ open, onOpenChange, onInsert }: ImagePickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <ImagePickerContent
          onInsert={onInsert}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}