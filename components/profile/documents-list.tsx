"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Download, Eye, FileText, Loader2, Pencil, SearchX, Trash2 } from "lucide-react"

import { deleteExportAction, renameExportAction } from "@/app/profile/actions"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { DocumentPreviewDialog } from "@/components/profile/document-preview-dialog"
import { ProfilePagination } from "@/components/profile/profile-pagination"
import { getFileType } from "@/components/profile/file-type"
import { cn } from "@/lib/utils"
import type { DocumentItem, ListQuery } from "@/components/profile/types"

function resultsHref(query: ListQuery, page: number): string {
  const params = new URLSearchParams({ tab: query.tab, page: String(page) })
  if (query.q) params.set("q", query.q)
  if (query.sort) params.set("sort", query.sort)
  return `/profile?${params.toString()}`
}

function EmptyState({ query }: { query: ListQuery }) {
  if (query.q) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <SearchX className="size-6" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium">Нічого не знайдено</p>
          <p className="text-sm text-muted-foreground">
            За запитом «{query.q}» збігів немає.
          </p>
        </div>
        <Link
          href={`/profile?tab=documents${query.sort ? `&sort=${query.sort}` : ""}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Очистити пошук
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <FileText className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium">Ще немає документів</p>
        <p className="max-w-[42ch] text-sm text-muted-foreground">
          Створіть перший документ із шаблону — він одразу з&apos;явиться тут.
        </p>
      </div>
      <Link href="/templates" className={cn(buttonVariants({ size: "sm" }))}>
        До каталогу шаблонів
      </Link>
    </div>
  )
}

function DocumentCard({
  item,
  deleting,
  onPreview,
  onRename,
  onDelete,
}: {
  item: DocumentItem
  deleting: boolean
  onPreview: () => void
  onRename: () => void
  onDelete: () => void
}) {
  const type = getFileType(item.mimeType, item.fileName)
  const Icon = type.Icon

  return (
    <article className="group flex h-full flex-col rounded-2xl border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform duration-200 group-hover:scale-105",
            type.iconClassName
          )}
        >
          <Icon className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={onPreview}
              title="Переглянути документ"
              className="min-w-0 truncate text-left text-sm font-semibold transition-colors hover:text-primary hover:underline"
            >
              {item.title}
            </button>
            {item.templateTitle && (
              <Badge
                variant="outline"
                className="shrink-0 rounded-full text-[10px]"
              >
                {item.templateTitle}
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground">
            <span>{type.label}</span>
            <span aria-hidden>·</span>
            <span className="truncate">{item.fileName}</span>
          </div>
        </div>
      </div>

      <div className="my-3 border-t" />

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{item.sizeLabel}</span>
        <span aria-hidden>·</span>
        <span>{item.createdAtLabel}</span>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-center"
          aria-label="Переглянути"
          onClick={onPreview}
        >
          <Eye className="size-4" />
          <span className="hidden sm:inline">Переглянути</span>
        </Button>

        <a
          href={`/api/exports/${item.id}`}
          aria-label="Завантажити"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "justify-center"
          )}
        >
          <Download className="size-4" />
          <span className="hidden sm:inline">Завантажити</span>
        </a>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-center"
          aria-label="Перейменувати"
          onClick={onRename}
        >
          <Pencil className="size-4" />
          <span className="hidden sm:inline">Перейменувати</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="justify-center text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label="Видалити"
          disabled={deleting}
          onClick={onDelete}
        >
          {deleting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
          <span className="hidden sm:inline">Видалити</span>
        </Button>
      </div>
    </article>
  )
}

export function DocumentsList({
  items,
  query,
  total,
  totalPages,
}: {
  items: DocumentItem[]
  query: ListQuery
  total: number
  totalPages: number
}) {
  const router = useRouter()
  const [target, setTarget] = React.useState<DocumentItem | null>(null)
  const [preview, setPreview] = React.useState<DocumentItem | null>(null)
  const [rename, setRename] = React.useState<DocumentItem | null>(null)
  const [renameValue, setRenameValue] = React.useState("")
  const [pendingId, setPendingId] = React.useState<string | null>(null)
  const [isPending, startTransition] = React.useTransition()
  const [renamePending, startRenameTransition] = React.useTransition()

  function confirmDelete() {
    if (!target) return
    const id = target.id
    setPendingId(id)
    startTransition(async () => {
      const result = await deleteExportAction(id)
      setPendingId(null)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      setTarget(null)
      // Останній елемент на сторінці → повертаємось на попередню.
      if (items.length === 1 && query.page > 1) {
        router.replace(resultsHref(query, query.page - 1))
      } else {
        router.refresh()
      }
    })
  }

  function openRename(item: DocumentItem) {
    setRename(item)
    setRenameValue(item.title)
  }

  function submitRename(event: React.FormEvent) {
    event.preventDefault()
    if (!rename) return
    const title = renameValue.trim()
    if (!title) return
    startRenameTransition(async () => {
      const result = await renameExportAction(rename.id, title)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      setRename(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {query.q
            ? `Знайдено: ${total}`
            : total === 0
              ? "Немає документів"
              : `Усього: ${total} · сторінка ${query.page} з ${totalPages}`}
        </span>
      </div>

      {items.length === 0 ? (
        <EmptyState query={query} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className="h-full">
              <DocumentCard
                item={item}
                deleting={pendingId === item.id}
                onPreview={() => setPreview(item)}
                onRename={() => openRename(item)}
                onDelete={() => setTarget(item)}
              />
            </li>
          ))}
        </ul>
      )}

      <ProfilePagination query={query} totalPages={totalPages} />

      {/* Діалог перейменування */}
      <Dialog
        open={rename !== null}
        onOpenChange={(open) => {
          if (!open && !renamePending) setRename(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Перейменувати документ</DialogTitle>
            <DialogDescription>
              Введіть нову назву. Розширення .docx додається автоматично.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitRename} className="grid gap-4">
            <Input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              placeholder="Назва документа"
              maxLength={200}
              autoFocus
              required
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRename(null)}
                disabled={renamePending}
              >
                Скасувати
              </Button>
              <Button
                type="submit"
                disabled={renamePending || renameValue.trim().length === 0}
              >
                {renamePending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Pencil className="size-4" />
                )}
                Зберегти
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Діалог видалення */}
      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Видалити документ?</DialogTitle>
            <DialogDescription>
              Документ «{target?.title}» буде видалено назавжди. Цю дію не можна
              скасувати.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTarget(null)}
              disabled={isPending}
            >
              Скасувати
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Видалити
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DocumentPreviewDialog
        document={preview}
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open) setPreview(null)
        }}
      />
    </div>
  )
}
