"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, Eye, FileText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { TemplatesFilter } from "@/components/templates/templates-filter"

type DocCard = {
  id: string
  title: string
  status: string
  createdAt: string
  updatedAt: string
  author: string | null
  templateTitle: string
}

export function DocumentsClient({ documents }: { documents: DocCard[] }) {
  const [query, setQuery] = React.useState("")

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return documents
    return documents.filter((d) => {
      const hay = `${d.title} ${d.templateTitle} ${d.author ?? ""} ${d.status}`.toLowerCase()
      return hay.includes(q)
    })
  }, [documents, query])

  return (
    <div className="space-y-4">
      <TemplatesFilter total={documents.length} filtered={filtered.length} onQueryChange={setQuery} />

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-12 text-center">
          <p className="text-sm font-medium">Нічого не знайдено</p>
          <p className="mt-1 text-sm text-muted-foreground">Спробуйте інший запит — наприклад, «Богатир», «Петренко» або «чернетка».</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => (
            <Card key={d.id} className="group flex h-full flex-col overflow-hidden py-0">
              <div className="absolute inset-x-0 top-0 h-0.5 bg-primary opacity-0 transition-opacity group-hover:opacity-100" />
              <CardHeader className="gap-2 p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="size-4" />
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={d.status === "чернетка" ? "secondary" : "default"} className="rounded-full text-[11px]">
                      {d.status}
                    </Badge>
                  </div>
                </div>
                <CardTitle className="line-clamp-2 text-[14px] leading-snug">{d.title}</CardTitle>
                <div className="text-xs text-muted-foreground">
                  {d.author ?? "—"} • {new Date(d.updatedAt).toLocaleDateString("uk-UA")}
                </div>
                <CardDescription className="line-clamp-2 text-sm leading-relaxed">{d.templateTitle}</CardDescription>
              </CardHeader>

              <CardContent className="flex flex-wrap gap-1.5 p-4 pt-2">
                <Badge variant="outline" className="rounded-full text-[11px]">
                  {d.status}
                </Badge>
                <Badge variant="outline" className="rounded-full text-[11px]">
                  {d.author ?? "—"}
                </Badge>
              </CardContent>

              <CardFooter className="mt-auto gap-2 p-4 pt-0">
                <Link href={`/documents/${d.id}/edit`} className={cn(buttonVariants({ size: "sm" }), "flex-1")}>
                  Редагувати
                  <ArrowRight className="size-3.5" />
                </Link>
                <Link href={`/documents/${d.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-1")}>
                  <Eye className="size-3.5" />
                  Перегляд
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
