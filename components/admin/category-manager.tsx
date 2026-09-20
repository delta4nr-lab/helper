"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Power,
  Trash2,
} from "lucide-react"

import {
  createCategoryAction,
  deleteCategoryAction,
  moveCategoryAction,
  toggleCategoryAction,
  updateCategoryAction,
} from "@/lib/categories/actions"
import {
  CATEGORY_ICONS,
  CategoryIcon,
  normalizeCategoryIcon,
  type CategoryIconKey,
} from "@/lib/categories/icons"
import { slugify } from "@/lib/slugify"
import { ConfirmDelete } from "@/components/shared/confirm-delete"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Category = {
  id: string
  title: string
  slug: string
  description: string
  longDescription: string | null
  sortOrder: number
  icon: string | null
  isActive: boolean
  templates: number
}

type FormState = {
  title: string
  description: string
  longDescription: string
  icon: CategoryIconKey
}

const emptyForm: FormState = {
  title: "",
  description: "",
  longDescription: "",
  icon: "folder",
}

// Пікер іконки: компактна сітка 10 іконок у DropdownMenu (без нових залежностей).
function IconPicker({
  value,
  onChange,
}: {
  value: CategoryIconKey
  onChange: (key: CategoryIconKey) => void
}) {
  const selected = CATEGORY_ICONS.find((entry) => entry.key === value)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start gap-2"
          />
        }
      >
        <CategoryIcon value={value} className="size-4" />
        <span className="truncate">{selected?.label ?? "Обрати іконку"}</span>
        <ChevronDown className="ml-auto size-4 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 p-2">
        <div className="grid grid-cols-5 gap-1">
          {CATEGORY_ICONS.map((entry) => (
            <DropdownMenuItem
              key={entry.key}
              title={entry.label}
              aria-label={entry.label}
              onClick={() => onChange(entry.key)}
              className="justify-center"
            >
              <CategoryIcon value={entry.key} className="size-4" />
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function CategoryManager({
  initialCategories,
}: {
  initialCategories: Category[]
}) {
  const router = useRouter()
  const [categories, setCategories] = React.useState(initialCategories)
  const [editing, setEditing] = React.useState<Category | null>(null)
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState(emptyForm)
  const [message, setMessage] = React.useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = React.useState<Category | null>(
    null
  )
  const [pending, startTransition] = React.useTransition()

  function openForm(category: Category | null) {
    setEditing(category)
    setForm(
      category
        ? {
            title: category.title,
            description: category.description,
            longDescription: category.longDescription ?? "",
            icon: normalizeCategoryIcon(category.icon) ?? "folder",
          }
        : emptyForm
    )
    setMessage(null)
    setOpen(true)
  }

  function update(key: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      if (editing) {
        const result = await updateCategoryAction(editing.id, form)
        setMessage(result.message)
        if (result.ok) {
          // Одразу відображаємо зміни в списку, не чекаючи перезавантаження.
          setCategories((current) =>
            current.map((item) =>
              item.id === editing.id
                ? {
                    ...item,
                    title: form.title,
                    description: form.description,
                    longDescription: form.longDescription || null,
                    icon: form.icon,
                  }
                : item
            )
          )
          setOpen(false)
          router.refresh()
        }
        return
      }

      const result = await createCategoryAction(form)
      setMessage(result.message)
      if (result.ok) {
        const created = result.category
        if (created) setCategories((current) => [...current, created])
        setOpen(false)
        router.refresh()
      }
    })
  }

  function move(category: Category, direction: "up" | "down") {
    const index = categories.findIndex((item) => item.id === category.id)
    const target = direction === "up" ? index - 1 : index + 1
    if (index === -1 || target < 0 || target >= categories.length) return

    const next = categories.slice()
    ;[next[index], next[target]] = [next[target], next[index]]
    setCategories(next)

    startTransition(async () => {
      const result = await moveCategoryAction(category.id, direction)
      if (!result.ok) {
        setMessage(result.message)
        router.refresh()
      }
    })
  }

  function toggle(category: Category) {
    startTransition(async () => {
      const result = await toggleCategoryAction(category.id, !category.isActive)
      if (result.ok) {
        setCategories((current) =>
          current.map((item) =>
            item.id === category.id
              ? { ...item, isActive: !item.isActive }
              : item
          )
        )
      } else {
        setMessage(result.message)
      }
    })
  }

  function confirmRemove() {
    if (!confirmTarget) return
    const id = confirmTarget.id
    startTransition(async () => {
      const result = await deleteCategoryAction(id)
      setConfirmTarget(null)
      setMessage(result.message)
      if (result.ok) {
        setCategories((current) => current.filter((item) => item.id !== id))
      }
    })
  }

  const slugPreview = editing
    ? editing.slug
    : slugify(form.title) || "автоматично з назви"

  return (
    <>
      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm">Категорії шаблонів</CardTitle>
            <CardDescription>
              Створюйте та впорядковуйте розділи каталогу.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => openForm(null)}>
            <Plus className="size-4" />
            Додати
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {categories.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Категорій ще немає.
              </div>
            ) : (
              categories.map((category, index) => {
                return (
                  <div
                    key={category.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <CategoryIcon
                          value={category.icon}
                          className="size-4"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {category.title}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {category.slug} · {category.templates} шаблонів
                        </div>
                      </div>
                    </div>
                    <Badge
                      className={
                        category.isActive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : "bg-destructive/10 text-destructive dark:bg-destructive/20"
                      }
                    >
                      {category.isActive ? "Активна" : "Неактивна"}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === 0 || pending}
                        onClick={() => move(category, "up")}
                        aria-label="Перемістити вгору"
                        title="Перемістити вгору"
                      >
                        <ChevronUp className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === categories.length - 1 || pending}
                        onClick={() => move(category, "down")}
                        aria-label="Перемістити вниз"
                        title="Перемістити вниз"
                      >
                        <ChevronDown className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openForm(category)}
                        aria-label="Редагувати"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggle(category)}
                        aria-label={
                          category.isActive ? "Деактивувати" : "Активувати"
                        }
                      >
                        <Power className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setConfirmTarget(category)}
                        aria-label="Видалити"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
          {message && (
            <p className="border-t px-4 py-3 text-sm text-muted-foreground">
              {message}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Редагування категорії" : "Нова категорія"}
            </DialogTitle>
            <DialogDescription>
              Назва, опис та іконка категорії. Порядок змінюється стрілками у
              списку.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="category-title">Назва</Label>
              <Input
                id="category-title"
                required
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="category-slug">Slug</Label>
              <Input
                id="category-slug"
                value={slugPreview}
                readOnly
                disabled
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                {editing
                  ? "Slug не змінюється, щоб не ламати посилання."
                  : "Згенерується автоматично з назви."}
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="category-description">Опис</Label>
              <Input
                id="category-description"
                required
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="category-long-description">Розширений опис</Label>
              <Input
                id="category-long-description"
                value={form.longDescription}
                onChange={(e) => update("longDescription", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Іконка</Label>
              <IconPicker
                value={form.icon}
                onChange={(key) => update("icon", key)}
              />
            </div>
            {message && (
              <p className="text-sm text-muted-foreground">{message}</p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Скасувати
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Збереження..." : "Зберегти"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={confirmTarget !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmTarget(null)
        }}
        title="Видалити категорію?"
        description={
          confirmTarget
            ? `Категорію «${confirmTarget.title}» буде видалено. Категорію з шаблонами видалити не можна.`
            : ""
        }
        pending={pending}
        onConfirm={confirmRemove}
      />
    </>
  )
}
