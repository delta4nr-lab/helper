"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ExternalLink, ImageOff, Loader2, SearchX, Trash2 } from "lucide-react"

import { deleteImageAction } from "@/app/profile/actions"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ProfilePagination } from "@/components/profile/profile-pagination"
import { EmptyState } from "@/components/shared/empty-state"
import { buildProfileHref } from "@/lib/profile/query"
import { cn } from "@/lib/utils"
import type { ListQuery, MediaItem } from "@/components/profile/types"

export function MediaLibrary({
  items,
  query,
  total,
  totalPages,
}: {
  items: MediaItem[]
  query: ListQuery
  total: number
  totalPages: number
}) {
  const router = useRouter()
  const [target, setTarget] = React.useState<MediaItem | null>(null)
  const [pendingId, setPendingId] = React.useState<string | null>(null)
  const [isPending, startTransition] = React.useTransition()

  function confirmDelete() {
    if (!target) return
    const id = target.id
    setPendingId(id)
    startTransition(async () => {
      const result = await deleteImageAction(id)
      setPendingId(null)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      setTarget(null)
      // Останній елемент на сторінці → повертаємось на попередню.
      if (items.length === 1 && query.page > 1) {
        router.replace(buildProfileHref(query, query.page - 1))
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        {query.q
          ? `Знайдено: ${total}`
          : total === 0
            ? "Немає медіафайлів"
            : `Усього: ${total} · сторінка ${query.page} з ${totalPages}`}
      </div>

      {items.length === 0 ? (
        query.q ? (
          <EmptyState
            icon={SearchX}
            iconClassName="bg-muted text-muted-foreground"
            title="Нічого не знайдено"
            description={<>За запитом «{query.q}» збігів немає.</>}
            action={{
              href: buildProfileHref({ tab: "media", q: "", sort: query.sort }),
              label: "Очистити пошук",
            }}
          />
        ) : (
          <EmptyState
            icon={ImageOff}
            title="Ще немає медіафайлів"
            description="Зображення, які ви додаєте в документи, зберігаються тут."
            action={{
              href: "/templates",
              label: "До каталогу шаблонів",
              variant: "default",
            }}
          />
        )
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="group flex flex-col overflow-hidden rounded-2xl border bg-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="relative flex h-40 items-center justify-center overflow-hidden bg-muted/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.path}
                  alt={item.originalFilename}
                  loading="lazy"
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <div className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {item.originalFilename}
                  </span>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {item.dimensionsLabel} · {item.sizeLabel} ·{" "}
                    {item.createdAtLabel}
                  </div>
                </div>
                <div className="mt-auto flex items-center gap-1.5">
                  <a
                    href={item.path}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "flex-1 justify-center"
                    )}
                  >
                    <ExternalLink className="size-3.5" />
                    Відкрити
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="justify-center text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Видалити ${item.originalFilename}`}
                    disabled={pendingId === item.id}
                    onClick={() => setTarget(item)}
                  >
                    {pendingId === item.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    <span className="hidden sm:inline">Видалити</span>
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ProfilePagination query={query} totalPages={totalPages} />

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) setTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Видалити медіафайл?</DialogTitle>
            <DialogDescription>
              Файл «{target?.originalFilename}» буде видалено з бібліотеки та з
              сервера назавжди. Документи, де він уже вставлений, залишаться без
              змін.
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
    </div>
  )
}
