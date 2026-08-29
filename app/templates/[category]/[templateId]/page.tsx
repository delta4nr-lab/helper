import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight, ArrowLeft, FileText } from "lucide-react"

import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { templates, getCategory } from "@/lib/documents/catalog"
import { cn } from "@/lib/utils"
import { prisma } from "@/lib/db"
import { DocumentForm } from "@/components/documents/document-form"

type Params = { category: string; templateId: string }

export const dynamic = "force-dynamic"

export function generateStaticParams() {
  return templates.map((t) => ({
    category: t.categorySlug,
    templateId: t.id,
  }))
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { category, templateId } = await params
  try {
    if (prisma && (prisma as unknown as { template: unknown }).template) {
      const tpl = await prisma.template.findUnique({ where: { id: templateId } })
      if (tpl) {
        const cat = getCategory(category)
        return { title: `${tpl.title} — ${cat?.title ?? "Шаблони"}`, description: tpl.description }
      }
      // Якщо це документ (id документа), показати його заголовок
      const doc = await prisma.document.findUnique({ where: { id: templateId }, include: { template: true } })
      if (doc) {
        return { title: `${doc.title} — редагування`, description: `Редагування документа ${doc.template?.title ?? ""}` }
      }
    }
  } catch {}
  const tpl = getCategory(category) ? templates.find((t) => t.id === templateId) : null
  if (!tpl) return { title: "Шаблон не знайдено" }
  const cat = getCategory(category)
  return { title: `${tpl.title} — ${cat?.title ?? "Шаблони"}`, description: tpl.description }
}

export default async function TemplateDetailPage({ params }: { params: Promise<Params> }) {
  const { category, templateId } = await params

  // Безпечне завантаження з БД з fallback на catalog — виправляє 'prisma undefined'
  // Підтримує як /templates/raporty/raport-vidpustka (шаблон — створення) так і /templates/raporty/[documentId] (документ — редагування)
  let cat: { title: string } | null = null
  let fallbackCat = getCategory(category)
  let categoryTitle = fallbackCat?.title ?? category
  let tpl: any = null
  let personnel: any[] = []
  let editingDoc: any = null
  let dbError: string | null = null

  try {
    if (!prisma || !(prisma as unknown as { category: unknown }).category) {
      throw new Error("Prisma не ініціалізовано")
    }
    const dbCat = await prisma.category.findUnique({ where: { slug: category } })
    if (dbCat) {
      cat = dbCat
      categoryTitle = dbCat.title
    }
    const dbTpl = await prisma.template.findUnique({
      where: { id: templateId },
      include: { fieldsConfig: { orderBy: { sortOrder: "asc" } }, category: true },
    })
    if (dbTpl) {
      tpl = dbTpl as never
    } else {
      // Не шаблон — можливо документ (id або slug = назва документа)
      let doc: any = null
      try {
        doc = await prisma.document.findUnique({
          where: { id: templateId },
          include: { template: { include: { fieldsConfig: { orderBy: { sortOrder: "asc" } } } } },
        })
      } catch {
        doc = null
      }
      if (doc && doc.categorySlug === category) {
        editingDoc = doc
        tpl = doc.template
        if (!tpl?.fieldsConfig) {
          const fullTpl = await prisma.template.findUnique({
            where: { id: doc.templateId },
            include: { fieldsConfig: { orderBy: { sortOrder: "asc" } }, category: true },
          })
          if (fullTpl) tpl = fullTpl
        }
      } else {
        const allDocs = await prisma.document.findMany({
          where: { categorySlug: category },
          include: { template: { include: { fieldsConfig: { orderBy: { sortOrder: "asc" } } } } },
          take: 100,
        })
        const slug = templateId.toLowerCase()
        const bySlug = allDocs.find((d) => d.id === templateId || d.title.toLowerCase().replace(/[^a-z0-9а-яіїєґ]+/gi, "-").includes(slug) || d.title.toLowerCase().includes(slug))
        if (bySlug) {
          editingDoc = bySlug
          tpl = (bySlug as any).template
        }
      }
    }
    personnel = await prisma.personnel.findMany({ orderBy: { lastName: "asc" }, take: 50 })
  } catch (e) {
    const msg = (e as Error).message
    if (msg.includes("NEXT_NOT_FOUND")) throw e
    dbError = msg
    console.warn("[TemplateDetailPage] prisma fallback:", msg)
  }

  if (dbError) {
    return (
      <div className="flex min-h-svh flex-col bg-background">
        <SiteHeader />
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6">
            <h1 className="text-lg font-semibold text-destructive">Помилка завантаження</h1>
            <p className="mt-2 text-sm">ID: {templateId}</p>
            <p className="mt-2 text-sm">{dbError}</p>
          </div>
        </main>
        <SiteFooter />
      </div>
    )
  }

  // Fallback якщо БД недоступна — тільки для шаблонів
  if (!tpl && !editingDoc) {
    const fallbackTpl = templates.find((t) => t.id === templateId && t.categorySlug === category)
    if (!fallbackTpl) notFound()
    if (!fallbackCat) notFound()
    categoryTitle = fallbackCat.title
    tpl = {
      id: fallbackTpl.id,
      categorySlug: fallbackTpl.categorySlug,
      title: fallbackTpl.title,
      fields: fallbackTpl.fields,
      popular: fallbackTpl.popular,
      description: fallbackTpl.description,
      tags: fallbackTpl.tags,
      paper: fallbackTpl.paper,
      fieldsConfig: [],
      category: null,
    } as never
  }

  if (!tpl) notFound()
  if ((tpl as unknown as { categorySlug: string }).categorySlug !== category && !editingDoc) notFound()

  const isPilot = tpl.id === "raport-vidpustka"
  const isEditing = !!editingDoc

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        <div className="border-b bg-muted/30">
          <div className="mx-auto max-w-[1280px] px-4 py-4 sm:px-6 lg:px-8">
            <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground">Головна</Link>
              <ChevronRight className="size-3.5" />
              <Link href="/templates" className="hover:text-foreground">Шаблони</Link>
              <ChevronRight className="size-3.5" />
              <Link href={`/templates/${category}`} className="hover:text-foreground">{categoryTitle}</Link>
              <ChevronRight className="size-3.5" />
              <span className="font-medium text-foreground">{tpl.title}</span>
            </nav>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <FileText className="size-4" />
                  </span>
                  <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{isEditing ? editingDoc.title : tpl.title}</h1>
                  {tpl.popular && <Badge className="rounded-full">Популярний</Badge>}
                  {isEditing ? <Badge variant="default" className="rounded-full">Редагування</Badge> : !isPilot && <Badge variant="outline" className="rounded-full">В розробці</Badge>}
                </div>
                <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">{isEditing ? `Редагування документа на основі шаблону "${tpl.title}". Зміни збережуться в той же документ.` : tpl.description}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full">{tpl.fieldsConfig.length || tpl.fields} полів</Badge>
                  <Badge variant="outline" className="rounded-full">{tpl.paper}</Badge>
                  {tpl.tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="rounded-full text-xs">{tag}</Badge>
                  ))}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Link href={`/templates/${category}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                  <ArrowLeft className="size-4" />
                  Назад до категорії
                </Link>
                {isEditing && (
                  <Link href={`/documents/${editingDoc.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                    Перегляд
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
          {isPilot || isEditing ? (
            <DocumentForm
              template={{
                id: tpl.id,
                title: tpl.title,
                categorySlug: tpl.categorySlug,
                headerTemplate: (tpl as { headerTemplate?: string | null }).headerTemplate ?? null,
                bodyTemplate: (tpl as { bodyTemplate?: string | null }).bodyTemplate ?? null,
                footerTemplate: (tpl as { footerTemplate?: string | null }).footerTemplate ?? null,
              }}
              fields={tpl.fieldsConfig.map((f: { key: string; label: string; type: string; required: boolean; placeholder: string | null; options: unknown; sortOrder: number }) => ({
                key: f.key,
                label: f.label,
                type: f.type,
                required: f.required,
                placeholder: f.placeholder,
                options: f.options,
                sortOrder: f.sortOrder,
              }))}
              personnel={personnel}
              initialData={isEditing ? (editingDoc.data as Record<string, unknown>) : undefined}
              documentId={isEditing ? editingDoc.id : undefined}
            />
          ) : (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-sm">Шаблон в розробці</CardTitle>
                <CardDescription>
                  Фундамент готовий: Схема (Zod) → Template → Renderer → Server Action → Prisma вже реалізовано для
                   `raport-vidpustka`. Цей шаблон буде підключено наступним — достатньо додати `TemplateField` та
                  схему в `lib/documents/schemas/`.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Адмін зможе додати поля через `/admin` (CRUD `TemplateField`), а документ створюватиметься тим же `DocumentForm`
                без переписування коду.
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
