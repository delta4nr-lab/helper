import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight, ArrowLeft, FileText } from "lucide-react"

import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { templates, getCategory } from "@/lib/documents/catalog"
import { cn } from "@/lib/utils"
import { prisma } from "@/lib/db"
import { DocumentForm } from "@/components/documents/document-form"

type Params = { category: string; templateId: string }
type TemplateField = {
  key: string
  label: string
  type: string
  required: boolean
  placeholder: string | null
  options: unknown
  sortOrder: number
}
type TemplateData = {
  id: string
  categorySlug: string
  title: string
  fields: number
  popular: boolean
  description: string
  tags: string[]
  paper: string
  fieldsConfig: TemplateField[]
  headerTemplate?: string | null
  bodyTemplate?: string | null
  footerTemplate?: string | null
}
type Personnel = {
  id: string
  lastName: string
  firstName: string
  middleName: string | null
  rank: string
  position: string
}

export const dynamic = "force-dynamic"

export function generateStaticParams() {
  return templates.map((t) => ({
    category: t.categorySlug,
    templateId: t.id,
  }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { category, templateId } = await params
  try {
    if (prisma && (prisma as unknown as { template: unknown }).template) {
      const tpl = await prisma.template.findUnique({
        where: { id: templateId },
      })
      if (tpl) {
        const cat = getCategory(category)
        return {
          title: `${tpl.title} — ${cat?.title ?? "Шаблони"}`,
          description: tpl.description,
        }
      }
    }
  } catch {}
  const tpl = getCategory(category)
    ? templates.find((t) => t.id === templateId)
    : null
  if (!tpl) return { title: "Шаблон не знайдено" }
  const cat = getCategory(category)
  return {
    title: `${tpl.title} — ${cat?.title ?? "Шаблони"}`,
    description: tpl.description,
  }
}

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { category, templateId } = await params

  // Завантаження шаблону з БД з fallback на вбудований каталог.
  const fallbackCat = getCategory(category)
  let categoryTitle = fallbackCat?.title ?? category
  let tpl: TemplateData | null = null
  let personnel: Personnel[] = []
  let dbError: string | null = null

  try {
    if (!prisma || !(prisma as unknown as { category: unknown }).category) {
      throw new Error("Prisma не ініціалізовано")
    }
    const dbCat = await prisma.category.findUnique({
      where: { slug: category },
    })
    if (dbCat) {
      categoryTitle = dbCat.title
    }
    const dbTpl = await prisma.template.findUnique({
      where: { id: templateId },
      include: {
        fieldsConfig: { orderBy: { sortOrder: "asc" } },
        category: true,
      },
    })
    if (dbTpl) tpl = dbTpl as unknown as TemplateData
    personnel = await prisma.personnel.findMany({
      orderBy: { lastName: "asc" },
      take: 50,
    })
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
            <h1 className="text-lg font-semibold text-destructive">
              Помилка завантаження
            </h1>
            <p className="mt-2 text-sm">ID: {templateId}</p>
            <p className="mt-2 text-sm">{dbError}</p>
          </div>
        </main>
        <SiteFooter />
      </div>
    )
  }

  // Fallback якщо БД недоступна — тільки для шаблонів
  if (!tpl) {
    const fallbackTpl = templates.find(
      (t) => t.id === templateId && t.categorySlug === category
    )
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
    } as TemplateData
  }

  if (!tpl) notFound()
  if ((tpl as unknown as { categorySlug: string }).categorySlug !== category)
    notFound()

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        <div className="border-b bg-muted/30">
          <div className="mx-auto max-w-[1280px] px-4 py-4 sm:px-6 lg:px-8">
            <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground">
                Головна
              </Link>
              <ChevronRight className="size-3.5" />
              <Link href="/templates" className="hover:text-foreground">
                Шаблони
              </Link>
              <ChevronRight className="size-3.5" />
              <Link
                href={`/templates/${category}`}
                className="hover:text-foreground"
              >
                {categoryTitle}
              </Link>
              <ChevronRight className="size-3.5" />
              <span className="font-medium text-foreground">{tpl.title}</span>
            </nav>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <FileText className="size-4" />
                  </span>
                  <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                    {tpl.title}
                  </h1>
                  {tpl.popular && (
                    <Badge className="rounded-full">Популярний</Badge>
                  )}
                  <Badge variant="outline" className="rounded-full">
                    Готовий шаблон
                  </Badge>
                </div>
                <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
                  {tpl.description}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-full">
                    {tpl.fieldsConfig.length || tpl.fields} полів
                  </Badge>
                  <Badge variant="outline" className="rounded-full">
                    {tpl.paper}
                  </Badge>
                  {tpl.tags.map((tag: string) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="rounded-full text-xs"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/templates/${category}`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" })
                  )}
                >
                  <ArrowLeft className="size-4" />
                  Назад до категорії
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
          <DocumentForm
            template={{
              id: tpl.id,
              title: tpl.title,
              categorySlug: tpl.categorySlug,
              headerTemplate:
                (tpl as { headerTemplate?: string | null }).headerTemplate ??
                null,
              bodyTemplate:
                (tpl as { bodyTemplate?: string | null }).bodyTemplate ?? null,
              footerTemplate:
                (tpl as { footerTemplate?: string | null }).footerTemplate ??
                null,
            }}
            fields={tpl.fieldsConfig.map((f) => ({
              key: f.key,
              label: f.label,
              type: f.type,
              required: f.required,
              placeholder: f.placeholder,
              options: f.options,
              sortOrder: f.sortOrder,
            }))}
            personnel={personnel}
          />
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
