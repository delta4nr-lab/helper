import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, FileText, Layers, Search } from "lucide-react"

import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { CategoryCard } from "@/components/templates/category-card"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  getCategoryCounts,
  templates as fallbackTemplates,
} from "@/lib/documents/catalog"
import { orm } from "@/lib/db"

export const metadata: Metadata = {
  title: "Шаблони документів",
  description:
    "Каталог шаблонів для канцелярії: оберіть категорію рапортів та створіть документ. Адмін додасть інші категорії пізніше.",
}

export const dynamic = "force-dynamic"

export default async function TemplatesPage() {
  // Хаб без хардкоду — джерело істини БД, fallback на catalog якщо prisma недоступний (збірка без БД)
  let categories: ReturnType<typeof getCategoryCounts> = []
  let total = 0
  try {
    const dbCategories = await orm.Category.where({ isActive: true })
      .orderBy((c) => c.sortOrder.asc())
      .include("templates", (t) => t.where({ isActive: true }).count())
      .all()
    const { count: dbTemplatesCount } = await orm.Template.where({ isActive: true }).aggregate((agg) => ({ count: agg.count() }))
    if (dbCategories.length > 0) {
      categories = dbCategories.map((c) => ({
        slug: c.slug,
        title: c.title,
        description: c.description,
        longDescription: c.longDescription ?? c.description,
        countLabel: c.countLabel,
        icon: c.icon as "raporty",
        count: c.templates,
      }))
      total = dbTemplatesCount
    } else {
      throw new Error("no categories in DB")
    }
  } catch {
    categories = getCategoryCounts()
    total = fallbackTemplates.length
  }

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
              <span className="font-medium text-foreground">Шаблони</span>
            </nav>

            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    Каталог шаблонів
                  </h1>
                  <Badge variant="secondary" className="rounded-full">
                    {total} шаблонів
                  </Badge>
                </div>
                <p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
                  Оберіть категорію — всередині знайдете потрібний документ і
                  зможете одразу заповнити його в редакторі.
                </p>
              </div>

              <Card className="gap-0 py-0 lg:min-w-[320px]">
                <CardContent className="flex items-center gap-3 p-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Layers className="size-4" />
                  </span>
                  <div className="flex-1">
                    <div className="text-sm leading-none font-medium">
                      {categories.length}{" "}
                      {categories.length === 1 ? "категорія" : "категорій"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {categories.length === 1 ? "Тільки рапорти" : "Від рапортів до листування"}
                    </div>
                  </div>
                  <Separator orientation="vertical" className="h-8" />
                  <div className="text-right">
                    <div className="text-sm leading-none font-semibold">
                      {total}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      документів
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1">
                <Search className="size-3" />
                Всередині категорії є пошук за назвою, кодом і тегами
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1">
                <FileText className="size-3" />
                Усі документи — українською, формат А4
              </span>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <CategoryCard key={c.slug} category={c} count={c.count} />
            ))}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}