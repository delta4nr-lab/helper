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
import { prisma } from "@/lib/db"
import { auth } from "@/auth"

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
    if (prisma && (prisma as unknown as { category: unknown }).category) {
      const dbCategories = await prisma.category.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          _count: { select: { templates: { where: { isActive: true } } } },
        },
      })
      const dbTemplatesCount = await prisma.template.count({
        where: { isActive: true },
      })
      if (dbCategories.length > 0) {
        categories = dbCategories.map((c) => ({
          slug: c.slug,
          title: c.title,
          description: c.description,
          longDescription: c.longDescription ?? c.description,
          countLabel: c.countLabel,
          icon: c.icon as "raporty",
          count: c._count.templates,
        }))
        total = dbTemplatesCount
      } else {
        throw new Error("no categories in DB")
      }
    } else {
      throw new Error("prisma unavailable")
    }
  } catch {
    categories = getCategoryCounts()
    total = fallbackTemplates.length
  }

  let isAdmin = false
  try {
    const session = await (
      auth as unknown as () => Promise<{ user?: { role?: string } } | null>
    )()
    isAdmin = (session?.user as unknown as { role?: string })?.role === "ADMIN"
  } catch {}

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <SiteHeader />

      <main className="flex-1">
        {/* Хлібні крихти + заголовок */}
        <div className="border-b bg-muted/30">
          <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground">
                Головна
              </Link>
              <ChevronRight className="size-3.5" />
              <Link
                href="/templates"
                className="font-medium text-foreground hover:underline"
              >
                Шаблони
              </Link>
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
                  {isAdmin && (
                    <Link
                      href="/admin/templates/new"
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      + Створити шаблон
                    </Link>
                  )}
                </div>
                <p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
                  Оберіть категорію — всередині знайдете потрібний документ.
                  {isAdmin
                    ? " Як адмін ви можете створювати та редагувати шаблони."
                    : " Кожен шаблон має валідацію, підказки та передперегляд."}
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
                      {categories.length === 1
                        ? "Тільки рапорти"
                        : "Від рапортів до листування"}
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
                Порада: всередині категорії є пошук за назвою, кодом і тегами
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1">
                <FileText className="size-3" />
                Усі документи — українською, формат А4
              </span>
            </div>
          </div>
        </div>

        {/* Сітка категорій */}
        <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <CategoryCard key={c.slug} category={c} count={c.count} />
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-dashed bg-muted/20 p-4 text-sm leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">
              Адмін додасть категорії
            </span>{" "}
            — хаб читає з БД (
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              prisma.category
            </code>
            ), без хардкоду. Архітектура{" "}
            <span className="font-mono text-xs">
              Дані → Схема → Шаблон → Рендер → Export
            </span>{" "}
            підхопить новий тип автоматично.
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
