"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronDown, ChevronUp, FileCog, FileText, PanelBottom, PanelTop, Plus } from "lucide-react"

import { TiptapEditor } from "@/components/editor/tiptap-editor"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { createTemplateAction, updateTemplateAction } from "@/lib/documents/actions"

type Category = { slug: string; title: string }
type TemplateInitial = { title: string; categorySlug: string; description: string; header: string; body: string; footer: string }

export function TemplateForm({ categories, mode = "create", templateId, initial }: { categories: Category[]; mode?: "create" | "edit"; templateId?: string; initial?: TemplateInitial }) {
  const router = useRouter()
  type Section = "header" | "body" | "footer"
  const [sections, setSections] = React.useState<Section[]>(() => initial ? (["header", "body", "footer"] as const).filter((section) => Boolean(initial[section])) : [])
  const [content, setContent] = React.useState(initial ? { header: initial.header, body: initial.body, footer: initial.footer } : { header: "", body: "", footer: "" })
  const [parametersOpen, setParametersOpen] = React.useState(true)
  const [pending, startTransition] = React.useTransition()
  const [message, setMessage] = React.useState<string | null>(null)
  const [form, setForm] = React.useState(initial ? { title: initial.title, categorySlug: initial.categorySlug, description: initial.description } : { title: "", categorySlug: categories[0]?.slug ?? "", description: "" })

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function addSection(value: Section) {
    if (!sections.includes(value)) setSections((current) => [...current, value])
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(null)
    startTransition(async () => {
       const payload = { ...form, headerTemplate: content.header, bodyTemplate: content.body, footerTemplate: content.footer }
       const result = mode === "edit" && templateId ? await updateTemplateAction(templateId, payload) : await createTemplateAction(payload)
       setMessage(result.message)
       if (result.ok) router.push(mode === "edit" ? "/admin/templates" : `/templates/${form.categorySlug}/${result.templateId}`)
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4 px-6 py-5">
          <button type="button" onClick={() => setParametersOpen((value) => !value)} className="flex min-w-0 items-center gap-3 text-left">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileCog className="size-4" /></span>
             <span className="min-w-0"><CardTitle className="text-sm">Параметри шаблону</CardTitle><CardDescription className="truncate">Назва, категорія та короткий опис</CardDescription></span>
            {parametersOpen ? <ChevronUp className="size-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
          </button>
          <div className="flex shrink-0 items-center gap-2">
            {message && <p className="hidden text-sm text-muted-foreground sm:block">{message}</p>}
             <Button type="submit" disabled={pending} className="h-8 px-3">{pending ? "Збереження..." : mode === "edit" ? "Зберегти" : "Створити"}</Button>
          </div>
        </CardHeader>
        {parametersOpen && <CardContent className="grid gap-x-8 gap-y-7 border-t bg-muted/10 px-6 py-7 sm:grid-cols-2 lg:grid-cols-4">
          <div className="grid gap-2 lg:col-span-2"><Label htmlFor="title">Назва шаблону <span className="text-destructive">*</span></Label><Input id="title" required value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="Наприклад, рапорт на відпустку" className="h-10 bg-background" /><p className="text-xs leading-relaxed text-muted-foreground">За цією назвою система автоматично створить адресу шаблону.</p></div>
          <div className="grid gap-2 lg:col-span-2"><Label htmlFor="category">Категорія <span className="text-destructive">*</span></Label><Select items={categories.map((category) => ({ value: category.slug, label: category.title }))} value={form.categorySlug} onValueChange={(value) => update("categorySlug", value ?? "")}><SelectTrigger id="category" className="h-10 w-full bg-background"><SelectValue placeholder="Оберіть категорію" /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category.slug} value={category.slug} label={category.title}>{category.title}</SelectItem>)}</SelectContent></Select><p className="text-xs leading-relaxed text-muted-foreground">Допомагає користувачам знайти шаблон у каталозі.</p></div>
          <div className="grid gap-2 lg:col-span-4"><Label htmlFor="description">Короткий опис <span className="font-normal text-muted-foreground">(необовʼязково)</span></Label><Input id="description" value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="Для чого використовується цей шаблон" className="h-10 bg-background" /></div>
          {message && <p className="text-sm text-muted-foreground sm:hidden">{message}</p>}
        </CardContent>}
      </Card>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4 px-6 py-5">
           <div><CardTitle className="text-sm">Вміст шаблону</CardTitle><CardDescription>{mode === "edit" ? "Оновіть блоки документа та збережіть зміни." : "Додайте потрібні блоки документа."}</CardDescription></div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button type="button" variant="outline" className="h-9 gap-2 px-3"><Plus className="size-4" />Додати<ChevronDown className="size-3.5 text-muted-foreground" /></Button>} />
            <DropdownMenuContent align="end" sideOffset={8} className="w-56 rounded-xl p-1.5">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Секція документа</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(["header", "body", "footer"] as const).map((value) => <DropdownMenuItem key={value} className="gap-3 rounded-lg px-2.5 py-2 focus:bg-muted focus:text-foreground" disabled={sections.includes(value)} onClick={() => addSection(value)}>
                  <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">{value === "header" ? <PanelTop className="size-4" /> : value === "body" ? <FileText className="size-4" /> : <PanelBottom className="size-4" />}</span>
                  <span className="flex flex-col"><span className="font-medium">{value === "header" ? "Шапка" : value === "body" ? "Тіло документа" : "Підвал"}</span><span className="text-xs text-muted-foreground">{sections.includes(value) ? "Вже додано" : "Додати секцію"}</span></span>
                </DropdownMenuItem>)}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent className="space-y-6 px-6 pb-7">
          {sections.length === 0 ? <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-dashed bg-muted/10 px-6 text-center text-sm text-muted-foreground">Сторінка порожня. Натисніть «Додати», щоб створити перший блок.</div> : sections.map((value) => <section key={value} className="space-y-3 rounded-xl border bg-background p-5 shadow-sm">
            <h2 className="text-sm font-semibold">{value === "header" ? "Шапка" : value === "body" ? "Тіло документа" : "Підвал"}</h2>
            <TiptapEditor content={content[value]} onChange={(next) => setContent((current) => ({ ...current, [value]: next }))} placeholder={`Введіть ${value === "header" ? "шапку" : value === "body" ? "тіло документа" : "підвал"}...`} />
          </section>)}
        </CardContent>
       </Card>
       <div className="flex flex-wrap items-center justify-between gap-3"><Button type="button" variant="outline" onClick={() => router.push(mode === "edit" ? "/admin/templates" : "/templates")}><ArrowLeft className="size-4" />Скасувати</Button><Button type="submit" disabled={pending}>{pending ? "Збереження..." : mode === "edit" ? "Зберегти шаблон" : "Створити шаблон"}</Button></div>
    </form>
  )
}
