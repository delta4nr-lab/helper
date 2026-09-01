import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight, ArrowLeft } from "lucide-react"

import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { CategoryTemplatesClient } from "@/components/templates/category-templates-client"
import {
  categories as fallbackCategories,
  getCategory as getFallbackCategory,
  getTemplatesByCategory as getFallbackTemplatesByCategory,
} from "@/lib/documents/catalog"
import { cn } from "@/lib/utils"
import { orm } from "@/lib/db"

type Params = { category: string }

export const dynamic = "force-dynamic"

export function generateStaticParams() {
  return fallbackCategories.map((c) => ({ category: c.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { category } = await params
  try {
    const cat = await orm.Category.first({ slug: category })
    if (cat)
      return {
        title: `${cat.title} — шаблони`,
        description: cat.longDescription ?? cat.description,
      }
  } catch {}
  const cat = getFallbackCategory(category)
  if (!cat) return { title: "Категорію не знайдено" }
  return { title: `${cat.title} — шаблони`, description: cat.longDescription }
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { category } = await params

  let cat: {
    slug: string
    title: string
    description: string
    longDescription: string | null
    countLabel: string
  } | null = null
  let items: {
    id: string
    title: string
    categorySlug: string
    fields: number
    popular: boolean
    description: string
    tags: string[]
    paper: "А4" | "А4 альбом"
    updatedAt: string
  }[] = []
  try {
    const dbCat = await orm.Category.first({ slug: category })
    if (dbCat) {
      cat = {
        slug: dbCat.slug,
        title: dbCat.title,
        description: dbCat.description,
        longDescription: dbCat.longDescription,
        countLabel: dbCat.countLabel,
      }
      const dbTemplates = await orm.Template.where({ categorySlug: category, isActive: true }).orderBy((t) => t.title.asc()).all()
      items = dbTemplates
        .slice()
        .sort((a, b) => Number(b.popular) - Number(a.popular))
        .map((t) => ({
          id: t.id,
          title: t.title,
          categorySlug: t.categorySlug,
          fields: t.fields,
          popular: t.popular,
          description: t.description,
          tags: [...t.tags],
          paper: t.paper as "А4" | "А4 альбом",
          updatedAt: t.updatedAt.slice(0, 10),
        }))
    }
  } catch {}
  if (!cat) {
    const fallbackCat = getFallbackCategory(category)
    if (!fallbackCat) notFound()
    cat = {
      slug: fallbackCat.slug,
      title: fallbackCat.title,
      description: fallbackCat.description,
      longDescription: fallbackCat.longDescription,
      countLabel: fallbackCat.countLabel,
    }
    items = getFallbackTemplatesByCategory(category).map((t) => ({ ...t }))
  }
  if (!cat) notFound()

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        <div className="border-b bg-muted/30">
          <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground">
                Головна
              </Link>
              <ChevronRight className="size-3.5" />
              <Link href="/templates" className="hover:text-foreground">
                Шаблони
              </Link>
              <ChevronRight className="size-3.5" />
              <span className="font-medium text-foreground">{cat.title}</span>
            </nav>

            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight">
                      {cat.title}
                    </h1>
                    <Badge variant="secondary" className="rounded-full">
                      {items.length} {cat.countLabel}
                    </Badge>
                    <Badge variant="outline" className="rounded-full">
                      {cat.description}
                    </Badge>
                  </div>
                  <p className="max-w-[70ch] text-sm leading-relaxed text-muted-foreground">
                    {cat.longDescription} Оберіть потрібний документ — картки
                    нижче підтримують пошук як і шаблони.
                  </p>
                </div>

                <Link
                  href="/templates"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" })
                  )}
                >
                  <ArrowLeft className="size-4" />
                  Усі категорії
                </Link>
              </div>

              <Separator />

              {/* швидкі чіпи — якірний пошук */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Швидко знайти:</span>
                {items.slice(0, 4).map((t) => (
                  <Link
                    key={t.id}
                    href={`/templates/${cat.slug}/${t.id}`}
                    className="rounded-full border bg-card px-2.5 py-1 hover:bg-muted"
                  >
                    {t.title}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
          <CategoryTemplatesClient templates={items} />

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-sm">
            <p className="text-muted-foreground">
              Не знайшли потрібне? Створіть кастомний шаблон на базі існуючого.
            </p>
            <Link
              href="/templates"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Переглянути інші категорії
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
