import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRight, FileSearch, Search } from "lucide-react"

import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { TemplateCard } from "@/components/templates/template-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { searchTemplates } from "@/lib/db/templates"

export const metadata: Metadata = {
  title: "Пошук шаблонів",
  description: "Пошук шаблонів документів за назвою, описом та категорією.",
}

export const dynamic = "force-dynamic"

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q: rawQuery } = await searchParams
  const query = (rawQuery ?? "").trim()

  const result = query ? await searchTemplates({ q: query }) : { items: [], total: 0 }

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
              <span className="font-medium text-foreground">Пошук</span>
            </nav>

            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    Пошук шаблонів
                  </h1>
                  {query && (
                    <Badge variant="secondary" className="rounded-full">
                      {result.total}{" "}
                      {result.total === 1 ? "результат" : "результатів"}
                    </Badge>
                  )}
                </div>
                <p className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
                  {query ? (
                    <>
                      Результати за запитом{" "}
                      <span className="font-medium text-foreground">
                        «{query}»
                      </span>{" "}
                      серед усіх категорій.
                    </>
                  ) : (
                    "Введіть назву документа, категорію або тег — пошук працює по всьому каталогу."
                  )}
                </p>
              </div>

              <form action="/search" method="get" className="flex w-full gap-2 lg:max-w-md">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    name="q"
                    defaultValue={query}
                    placeholder="Пошук шаблонів..."
                    className="h-9 pl-9"
                    autoComplete="off"
                  />
                </div>
                <Button type="submit" size="lg" className="shrink-0">
                  Знайти
                </Button>
              </form>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
          {!query ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileSearch className="size-5" />
              </span>
              <p className="text-sm text-muted-foreground">
                Введіть запит, щоб знайти потрібний шаблон.
              </p>
              <Link
                href="/templates"
                className="text-sm font-medium text-primary hover:underline"
              >
                Перейти до каталогу
              </Link>
            </div>
          ) : result.items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
              <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <FileSearch className="size-5" />
              </span>
              <p className="text-sm text-muted-foreground">
                Нічого не знайдено за запитом «{query}».
              </p>
              <Link
                href="/templates"
                className="text-sm font-medium text-primary hover:underline"
              >
                Переглянути всі категорії
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((item) => (
                <TemplateCard
                  key={item.id}
                  template={item}
                  categoryTitle={item.categoryTitle}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
