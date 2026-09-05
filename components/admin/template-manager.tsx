"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileEdit, Loader2, Pencil, Plus, Search, Star, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { createTemplateAction, deleteTemplateAction, updateTemplateAction } from "@/lib/templates/actions"
import { PAPERS } from "@/lib/templates/types"

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
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export type TemplateRow = {
  id: string
  title: string
  categorySlug: string
  description: string
  tags: string[]
  paper: string
  isActive: boolean
  popular: boolean
  updatedAt: string
  fieldsCount: number
}

type CategoryOption = { slug: string; title: string }

function metaFormState(template: TemplateRow | null, categorySlug: string) {
  return {
    title: template?.title ?? "",
    categorySlug: template?.categorySlug ?? categorySlug,
    description: template?.description ?? "",
    tags: template?.tags.join(", ") ?? "",
    paper: template?.paper ?? PAPERS[0],
    popular: template?.popular ?? false,
    isActive: template?.isActive ?? false,
  }
}

export function TemplateManager({
  templates,
  categories,
}: {
  templates: TemplateRow[]
  categories: CategoryOption[]
}) {
  const router = useRouter()
  const [search, setSearch] = React.useState("")
  const [creating, setCreating] = React.useState(false)
  const [createSaving, setCreateSaving] = React.useState(false)
  const [createForm, setCreateForm] = React.useState(() => metaFormState(null, categories[0]?.slug ?? ""))
  const [createFile, setCreateFile] = React.useState<File | null>(null)

  const [editTemplate, setEditTemplate] = React.useState<TemplateRow | null>(null)
  const [editForm, setEditForm] = React.useState(() => metaFormState(null, categories[0]?.slug ?? ""))
  const [editSaving, setEditSaving] = React.useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null)

  const filteredTemplates = React.useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return templates
    return templates.filter(
      (template) =>
        template.title.toLowerCase().includes(needle) ||
        (categories.find((category) => category.slug === template.categorySlug)?.title ?? "")
          .toLowerCase()
          .includes(needle)
    )
  }, [templates, search, categories])

  async function handleCreate() {
    if (createSaving) return
    setCreateSaving(true)
    const formData = new FormData()
    formData.set("title", createForm.title)
    formData.set("categorySlug", createForm.categorySlug)
    formData.set("description", createForm.description)
    formData.set("tags", createForm.tags)
    formData.set("paper", createForm.paper)
    if (createFile) formData.set("file", createFile)
    const result = await createTemplateAction(formData)
    setCreateSaving(false)
    toast[result.ok ? "success" : "error"](result.message)
    if (result.ok && result.id) {
      setCreating(false)
      router.push(`/admin/templates/${result.id}`)
    }
  }

  async function handleEditSave() {
    if (!editTemplate || editSaving) return
    setEditSaving(true)
    const result = await updateTemplateAction(editTemplate.id, {
      title: editForm.title,
      categorySlug: editForm.categorySlug,
      description: editForm.description,
      tags: editForm.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      paper: editForm.paper,
      popular: editForm.popular,
      isActive: editForm.isActive,
    })
    setEditSaving(false)
    toast[result.ok ? "success" : "error"](result.message)
    if (result.ok) {
      setEditTemplate(null)
      router.refresh()
    }
  }

  return (
    <div className="mt-6 grid gap-6">
      {/* Список шаблонів */}
      <section className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <h2 className="text-sm font-semibold">
            Шаблони · {templates.length}
          </h2>
          <div className="relative ml-auto">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Пошук за назвою"
              className="h-8 w-56"
            />
            <Search className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
          <Button type="button" size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Створити шаблон
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Назва</th>
                <th className="px-3 py-2 font-medium">Категорія</th>
                <th className="px-3 py-2 font-medium">Полів</th>
                <th className="px-3 py-2 font-medium">Статус</th>
                <th className="px-3 py-2 font-medium">Оновлено</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredTemplates.map((template) => (
                <tr key={template.id} className="hover:bg-muted/40">
                  <td className="max-w-64 truncate px-3 py-2 font-medium" title={template.title}>
                    {template.title}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {categories.find((category) => category.slug === template.categorySlug)?.title ??
                      template.categorySlug}
                  </td>
                  <td className="px-3 py-2">{template.fieldsCount}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {template.isActive ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Активний
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        Приховано
                      </span>
                    )}
                    {template.popular && (
                      <Star className="ml-1 inline size-3.5 fill-amber-400 text-amber-400" />
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                    {template.updatedAt.slice(0, 10)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <Link
                      href={`/admin/templates/${template.id}`}
                      className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                    >
                      <FileEdit className="size-4" />
                      Редактор
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title="Редагувати метадані"
                      onClick={() => {
                        setEditTemplate(template)
                        setEditForm(metaFormState(template, categories[0]?.slug ?? ""))
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    {confirmDeleteId === template.id ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setConfirmDeleteId(null)
                          void deleteTemplateAction(template.id).then((result) => {
                            toast[result.ok ? "success" : "error"](result.message)
                            if (result.ok) router.refresh()
                          })
                        }}
                      >
                        Точно видалити?
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Видалити шаблон"
                        onClick={() => setConfirmDeleteId(template.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredTemplates.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    Шаблонів не знайдено.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Діалог створення */}
      <Dialog open={creating} onOpenChange={(open) => !open && setCreating(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Створити шаблон</DialogTitle>
            <DialogDescription>
              Опціонально завантажте стартовий Word-файл — без нього буде створено порожній документ A4.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="create-title">Назва шаблону</Label>
              <Input
                id="create-title"
                value={createForm.title}
                onChange={(event) => setCreateForm({ ...createForm, title: event.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="create-category">Категорія</Label>
              <select
                id="create-category"
                value={createForm.categorySlug}
                onChange={(event) => setCreateForm({ ...createForm, categorySlug: event.target.value })}
                className="border-input bg-background flex h-8 w-full rounded-md border px-2 text-sm"
              >
                {categories.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="create-description">Опис</Label>
              <Input
                id="create-description"
                value={createForm.description}
                onChange={(event) => setCreateForm({ ...createForm, description: event.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="create-tags">Теги (через кому)</Label>
                <Input
                  id="create-tags"
                  value={createForm.tags}
                  onChange={(event) => setCreateForm({ ...createForm, tags: event.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="create-paper">Папір</Label>
                <select
                  id="create-paper"
                  value={createForm.paper}
                  onChange={(event) => setCreateForm({ ...createForm, paper: event.target.value })}
                  className="border-input bg-background flex h-8 w-full rounded-md border px-2 text-sm"
                >
                  {PAPERS.map((paper) => (
                    <option key={paper} value={paper}>
                      {paper}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="create-file">Стартовий DOCX (опціонально)</Label>
              <Input
                id="create-file"
                type="file"
                accept=".docx"
                onChange={(event) => setCreateFile(event.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreating(false)}>
              Скасувати
            </Button>
            <Button type="button" onClick={() => void handleCreate()} disabled={createSaving}>
              {createSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              Створити й відкрити
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Діалог метаданих */}
      <Dialog open={editTemplate !== null} onOpenChange={(open) => !open && setEditTemplate(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Метадані шаблону</DialogTitle>
            <DialogDescription>Категорія, опис і видимість шаблону на сайті.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-title">Назва шаблону</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(event) => setEditForm({ ...editForm, title: event.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-category">Категорія</Label>
              <select
                id="edit-category"
                value={editForm.categorySlug}
                onChange={(event) => setEditForm({ ...editForm, categorySlug: event.target.value })}
                className="border-input bg-background flex h-8 w-full rounded-md border px-2 text-sm"
              >
                {categories.map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-description">Опис</Label>
              <Input
                id="edit-description"
                value={editForm.description}
                onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-tags">Теги (через кому)</Label>
                <Input
                  id="edit-tags"
                  value={editForm.tags}
                  onChange={(event) => setEditForm({ ...editForm, tags: event.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-paper">Папір</Label>
                <select
                  id="edit-paper"
                  value={editForm.paper}
                  onChange={(event) => setEditForm({ ...editForm, paper: event.target.value })}
                  className="border-input bg-background flex h-8 w-full rounded-md border px-2 text-sm"
                >
                  {PAPERS.map((paper) => (
                    <option key={paper} value={paper}>
                      {paper}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(event) => setEditForm({ ...editForm, isActive: event.target.checked })}
                  className="size-4 accent-primary"
                />
                Активний (видимий на сайті)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editForm.popular}
                  onChange={(event) => setEditForm({ ...editForm, popular: event.target.checked })}
                  className="size-4 accent-primary"
                />
                Популярний
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditTemplate(null)}>
              Скасувати
            </Button>
            <Button type="button" onClick={() => void handleEditSave()} disabled={editSaving}>
              {editSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              Зберегти
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
