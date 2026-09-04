"use client"

import * as React from "react"
import { normalizeImageBytes, useDocxEditor } from "@docx-editor.dev/react"
import { ImagePlus, Loader2, Search } from "lucide-react"
import { toast } from "sonner"

import { uk } from "@/lib/docx-editor/uk"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type UserImage = {
  id: number
  originalFilename: string
  path: string
  width: number
  height: number
}

const PAGE_SIZE = 24
// Формати, які редактор гарантовано вбудовує в DOCX (як і пакетний file picker)
const ACCEPT = "image/png,image/jpeg,image/gif"
const LIST_ERROR = "Не вдалося завантажити бібліотеку зображень."

function insertErrorText(reasonKey: string): string {
  const key = reasonKey.split(".").pop() ?? ""
  return uk.imageInsert.errors[key as keyof typeof uk.imageInsert.errors] ?? "Зображення не вдалося вставити."
}

type EditorInstance = NonNullable<ReturnType<typeof useDocxEditor>>

// Рушій звіряє розміри заголовка JPEG з декодованими пікселями: знімки з
// EXIF-орієнтацією 5-8 (телефонні фото) декодуються браузером повернутими —
// розбіжність дає "invalid-image". Прогресивне кодування (SOF C2+) теж
// ненадійне для внутрішнього декодера. Такі JPEG перекодовуємо в baseline
// без EXIF через canvas — браузер застосовує орієнтацію при декодуванні.
function jpegNeedsReencode(bytes: Uint8Array): boolean {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return false
  let i = 2
  while (i < bytes.length - 4) {
    if (bytes[i] !== 0xff) {
      i += 1
      continue
    }
    const marker = bytes[i + 1]
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2
      continue
    }
    if (marker === 0xda) return false // початок піксельних даних
    if (marker >= 0xc2 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return true
    }
    if (
      marker === 0xe1 &&
      bytes[i + 4] === 0x45 &&
      bytes[i + 5] === 0x78 &&
      bytes[i + 6] === 0x69 &&
      bytes[i + 7] === 0x66 &&
      bytes[i + 8] === 0 &&
      bytes[i + 9] === 0
    ) {
      const orientation = exifOrientation(bytes, i + 10)
      if (orientation !== null && orientation >= 5) return true
    }
    i += 2 + ((bytes[i + 2] << 8) | bytes[i + 3])
  }
  return false
}

function exifOrientation(bytes: Uint8Array, tiff: number): number | null {
  const little = bytes[tiff] === 0x49
  const read16 = (offset: number) =>
    little ? bytes[offset] | (bytes[offset + 1] << 8) : (bytes[offset] << 8) | bytes[offset + 1]
  const read32 = (offset: number) =>
    little ? read16(offset) | (read16(offset + 2) << 16) : (read16(offset) << 16) | read16(offset + 2)
  const ifd = tiff + read32(tiff + 4)
  const count = read16(ifd)
  for (let entry = 0; entry < count; entry += 1) {
    const item = ifd + 2 + entry * 12
    if (read16(item) === 0x0112) return read16(item + 8)
  }
  return null
}

async function reencodeJpeg(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const buffer = new ArrayBuffer(bytes.byteLength)
    new Uint8Array(buffer).set(bytes)
    const bitmap = await createImageBitmap(new Blob([buffer], { type: "image/jpeg" }))
    const canvas = document.createElement("canvas")
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext("2d")
    if (!context) return null
    context.drawImage(bitmap, 0, 0)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    )
    if (!blob) return null
    return new Uint8Array(await blob.arrayBuffer())
  } catch {
    return null
  }
}

// Спільна вставка: байти зображення → валідація → вбудовування в DOCX у каретку.
async function insertImageIntoDocument(editor: EditorInstance, image: UserImage): Promise<boolean> {
  try {
    const response = await fetch(image.path)
    if (!response.ok) {
      toast.error("Не вдалося завантажити зображення.")
      return false
    }
    let payload = normalizeImageBytes(new Uint8Array(await response.arrayBuffer()))
    if (!payload.ok) {
      toast.error(insertErrorText(payload.reasonKey))
      return false
    }
    if (payload.mime === "image/jpeg" && jpegNeedsReencode(payload.bytes)) {
      const reencoded = await reencodeJpeg(payload.bytes)
      if (reencoded) {
        const reparsed = normalizeImageBytes(reencoded)
        if (reparsed.ok) payload = reparsed
      }
    }
    const result = await editor.executeImageCommand({
      type: "insertImage",
      data: payload.bytes,
      mime: payload.mime,
      widthPoints: payload.widthPoints,
      heightPoints: payload.heightPoints,
    })
    if (!result.ok) {
      toast.error(result.reason ?? "Зображення не вдалося вставити.")
      return false
    }
    toast.success("Зображення вставлено в документ.")
    return true
  } catch {
    toast.error("Не вдалося підключитися до сервера. Спробуйте ще раз.")
    return false
  }
}

async function uploadImageFile(file: File): Promise<UserImage | null> {
  try {
    const form = new FormData()
    form.set("file", file)
    const response = await fetch("/api/images/upload", { method: "POST", body: form })
    const result = (await response.json().catch(() => null)) as
      | (UserImage & { message?: string })
      | null
    if (!response.ok || !result) {
      toast.error(result?.message ?? "Не вдалося завантажити зображення.")
      return null
    }
    return {
      id: result.id,
      originalFilename: file.name,
      path: result.path,
      width: result.width,
      height: result.height,
    }
  } catch {
    toast.error("Не вдалося підключитися до сервера. Спробуйте ще раз.")
    return null
  }
}

// Діалог вставки зображення: таб «Завантаження» (новий файл на сервер у
// бібліотеку користувача: POST /api/images/upload → public/uploads/users/{userId}/images)
// і таб «Бібліотека» (вибір раніше завантажених: GET /api/images). У документ
// байти вбудовує редактор (executeImageCommand) — експортний DOCX несе їх у собі.
export function ImageInsertDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const editor = useDocxEditor()
  const [activeTab, setActiveTab] = React.useState<"upload" | "library">("upload")
  const [uploaded, setUploaded] = React.useState<UserImage | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [images, setImages] = React.useState<UserImage[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [query, setQuery] = React.useState("")
  const [appliedQuery, setAppliedQuery] = React.useState("")
  const [selectedId, setSelectedId] = React.useState<number | null>(null)
  const [inserting, setInserting] = React.useState(false)
  // Записи, файл яких не завантажився (осиротілі в БД) — показуємо з позначкою
  const [brokenIds, setBrokenIds] = React.useState<Set<number>>(new Set())
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const listKey = `${page}|${appliedQuery}`
  const [loadedKey, setLoadedKey] = React.useState<string | null>(null)
  const libraryLoading = open && loadedKey !== listKey

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    void (async () => {
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
        if (appliedQuery) params.set("q", appliedQuery)
        const response = await fetch(`/api/images?${params}`)
        const result = (await response.json().catch(() => null)) as
          | { images?: UserImage[]; total?: number; message?: string }
          | null
        if (cancelled) return
        if (!response.ok) throw new Error(result?.message ?? LIST_ERROR)
        const next = result?.images ?? []
        setImages((prev) => (page === 1 ? next : [...prev, ...next]))
        setTotal(result?.total ?? 0)
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : LIST_ERROR)
      } finally {
        if (!cancelled) setLoadedKey(listKey)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, page, appliedQuery, listKey])

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
    if (next) return
    setActiveTab("upload")
    setUploaded(null)
    setImages([])
    setTotal(0)
    setPage(1)
    setQuery("")
    setAppliedQuery("")
    setSelectedId(null)
    setBrokenIds(new Set())
    setLoadedKey(null)
  }

  async function handleInsert() {
    if (!editor || inserting) return
    const image =
      activeTab === "upload" ? uploaded : (images.find((item) => item.id === selectedId) ?? null)
    if (!image) return
    if (brokenIds.has(image.id)) {
      toast.error("Файл цього зображення відсутній на сервері.")
      return
    }
    setInserting(true)
    const ok = await insertImageIntoDocument(editor, image)
    setInserting(false)
    if (ok) handleOpenChange(false)
  }

  const canInsert = activeTab === "upload" ? uploaded !== null : selectedId !== null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Вставити зображення</DialogTitle>
          <DialogDescription>
            Завантажте новий файл або оберіть раніше завантажене — зображення вбудовується в документ.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as "upload" | "library")}
        >
          <TabsList className="w-full">
            <TabsTrigger value="upload">Завантаження</TabsTrigger>
            <TabsTrigger value="library">Бібліотека</TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            {uploaded ? (
              <div className="rounded-lg border p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={uploaded.path}
                  alt={uploaded.originalFilename}
                  className="mx-auto max-h-48 rounded bg-muted object-contain"
                />
                <div className="mt-2 truncate text-sm" title={uploaded.originalFilename}>
                  {uploaded.originalFilename}
                </div>
                <div className="text-xs text-muted-foreground">
                  {uploaded.width}×{uploaded.height} px
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex min-h-44 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50"
              >
                {uploading ? <Loader2 className="size-6 animate-spin" /> : <ImagePlus className="size-6" />}
                <span className="text-sm">{uploading ? "Завантаження..." : "Обрати файл"}</span>
                <span className="text-xs">PNG, JPEG або GIF, до 10 МБ</span>
              </button>
            )}
          </TabsContent>

          <TabsContent value="library">
            <form
              className="relative mb-2"
              onSubmit={(event) => {
                event.preventDefault()
                setPage(1)
                setAppliedQuery(query.trim())
              }}
            >
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Пошук за іменем"
                className="pr-8"
              />
              <Search className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            </form>
            <div className="max-h-64 min-h-40 overflow-y-auto rounded-lg border border-border/50 p-2">
              {images.length === 0 && !libraryLoading ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Немає завантажених зображень.
                </p>
              ) : (
                <div className={cn("grid grid-cols-3 gap-2", libraryLoading && "opacity-50")}>
                  {images.map((image) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => setSelectedId(image.id)}
                      onDoubleClick={() => void handleInsert()}
                  className={cn(
                    "rounded-lg border p-1.5 text-left transition-colors",
                    selectedId === image.id
                      ? "border-primary ring-1 ring-primary"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  {brokenIds.has(image.id) ? (
                    <div className="flex h-20 w-full items-center justify-center rounded bg-muted px-1 text-center text-[10px] text-muted-foreground">
                      Файл відсутній
                    </div>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={image.path}
                      alt={image.originalFilename}
                      className="h-20 w-full rounded bg-muted object-contain"
                      loading="lazy"
                      onError={() =>
                        setBrokenIds((prev) => new Set(prev).add(image.id))
                      }
                    />
                  )}
                      <span
                        className="mt-1 block truncate text-xs text-muted-foreground"
                        title={image.originalFilename}
                      >
                        {image.originalFilename}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        {image.width}×{image.height}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {images.length < total && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setPage((value) => value + 1)}
                disabled={libraryLoading}
              >
                {libraryLoading ? <Loader2 className="size-4 animate-spin" /> : null}
                Показати ще{total - images.length > 0 ? ` (${total - images.length})` : ""}
              </Button>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Скасувати
          </Button>
          <Button type="button" onClick={() => void handleInsert()} disabled={!canInsert || inserting}>
            {inserting ? <Loader2 className="size-4 animate-spin" /> : null}
            Вставити
          </Button>
        </DialogFooter>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) {
              setUploading(true)
              void uploadImageFile(file).then((image) => {
                if (image) setUploaded(image)
                setUploading(false)
              })
            }
            event.target.value = ""
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
