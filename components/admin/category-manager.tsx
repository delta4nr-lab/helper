"use client"

import * as React from "react"
import { Pencil, Plus, Power, Trash2 } from "lucide-react"

import { createCategoryAction, deleteCategoryAction, toggleCategoryAction, updateCategoryAction } from "@/lib/categories/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Category = { id: string; title: string; slug: string; description: string; longDescription: string | null; icon: string | null; sortOrder: number; isActive: boolean; _count: { templates: number; documents: number } }
type FormState = { title: string; slug: string; description: string; longDescription: string; sortOrder: string; icon: string }
const emptyForm: FormState = { title: "", slug: "", description: "", longDescription: "", sortOrder: "0", icon: "" }

function toForm(category: Category | null): FormState {
  return category ? { title: category.title, slug: category.slug, description: category.description, longDescription: category.longDescription ?? "", sortOrder: String(category.sortOrder), icon: category.icon ?? "" } : emptyForm
}

export function CategoryManager({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = React.useState(initialCategories)
  const [editing, setEditing] = React.useState<Category | null>(null)
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState(emptyForm)
  const [message, setMessage] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  function openForm(category: Category | null) { setEditing(category); setForm(toForm(category)); setMessage(null); setOpen(true) }
  function update(key: keyof FormState, value: string) { setForm((current) => ({ ...current, [key]: value })) }
  function submit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = editing ? await updateCategoryAction(editing.id, form) : await createCategoryAction(form)
      setMessage(result.message)
      if (result.ok) { setOpen(false); window.location.reload() }
    })
  }
  function toggle(category: Category) { startTransition(async () => { const result = await toggleCategoryAction(category.id, !category.isActive); if (result.ok) setCategories((current) => current.map((item) => item.id === category.id ? { ...item, isActive: !item.isActive } : item)); else setMessage(result.message) }) }
  function remove(category: Category) { if (!window.confirm(`Видалити категорію «${category.title}»?`)) return; startTransition(async () => { const result = await deleteCategoryAction(category.id); setMessage(result.message); if (result.ok) setCategories((current) => current.filter((item) => item.id !== category.id)) }) }

  return <Card className="mt-6"><CardHeader className="flex-row items-center justify-between gap-3"><div><CardTitle className="text-sm">Категорії документів</CardTitle><CardDescription>Створюйте та впорядковуйте розділи каталогу.</CardDescription></div><Button size="sm" onClick={() => openForm(null)}><Plus className="size-4" />Додати</Button></CardHeader><CardContent className="p-0"><div className="divide-y">{categories.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground">Категорій ще немає.</div> : categories.map((category) => <div key={category.id} className="flex flex-wrap items-center gap-3 px-4 py-3"><div className="flex min-w-0 flex-1 items-center gap-3"><div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-semibold">{category.title.slice(0, 1)}</div><div className="min-w-0"><div className="truncate text-sm font-medium">{category.title}</div><div className="truncate text-xs text-muted-foreground">{category.slug} · {category._count.templates} шаблонів · {category._count.documents} документів</div></div></div><Badge variant={category.isActive ? "secondary" : "outline"}>{category.isActive ? "Активна" : "Неактивна"}</Badge><div className="flex items-center gap-1"><Button variant="ghost" size="icon-sm" onClick={() => openForm(category)} aria-label="Редагувати"><Pencil className="size-3.5" /></Button><Button variant="ghost" size="icon-sm" onClick={() => toggle(category)} aria-label={category.isActive ? "Деактивувати" : "Активувати"}><Power className="size-3.5" /></Button><Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" onClick={() => remove(category)} aria-label="Видалити"><Trash2 className="size-3.5" /></Button></div></div>)}</div>{message && <p className="border-t px-4 py-3 text-sm text-muted-foreground">{message}</p>}</CardContent><Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{editing ? "Редагування категорії" : "Нова категорія"}</DialogTitle><DialogDescription>Категорія групує шаблони в каталозі документів.</DialogDescription></DialogHeader><form onSubmit={submit} className="grid gap-4"><div className="grid gap-1.5"><Label htmlFor="category-title">Назва</Label><Input id="category-title" required value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Рапорти" /></div><div className="grid gap-1.5"><Label htmlFor="category-slug">Slug</Label><Input id="category-slug" required disabled={!!editing} value={form.slug} onChange={(e) => update("slug", e.target.value.toLowerCase())} placeholder="raporty" /></div><div className="grid gap-1.5"><Label htmlFor="category-description">Короткий опис</Label><Input id="category-description" required value={form.description} onChange={(e) => update("description", e.target.value)} /></div><div className="grid gap-1.5"><Label htmlFor="category-long-description">Розширений опис</Label><Input id="category-long-description" value={form.longDescription} onChange={(e) => update("longDescription", e.target.value)} /></div><div className="grid grid-cols-2 gap-3"><div className="grid gap-1.5"><Label htmlFor="category-sort">Порядок</Label><Input id="category-sort" type="number" min="0" value={form.sortOrder} onChange={(e) => update("sortOrder", e.target.value)} /></div><div className="grid gap-1.5"><Label htmlFor="category-icon">Іконка <span className="font-normal text-muted-foreground">(необовʼязково)</span></Label><Input id="category-icon" value={form.icon} onChange={(e) => update("icon", e.target.value)} placeholder="raporty" /></div></div>{message && <p className="text-sm text-destructive">{message}</p>}<DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Скасувати</Button><Button type="submit" disabled={pending}>{pending ? "Збереження..." : editing ? "Зберегти" : "Створити"}</Button></DialogFooter></form></DialogContent></Dialog></Card>
}
