"use client"

import * as React from "react"
import { TemplatesFilter } from "@/components/templates/templates-filter"
import { TemplateCard } from "@/components/templates/template-card"
import type { TemplateDefinition } from "@/lib/documents/catalog"

export function CategoryTemplatesClient({ templates }: { templates: TemplateDefinition[] }) {
  const [query, setQuery] = React.useState("")

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return templates
    return templates.filter((t) => {
      const hay = `${t.title} ${t.description} ${t.tags.join(" ")}`.toLowerCase()
      return hay.includes(q)
    })
  }, [templates, query])

  return (
    <div className="space-y-4">
      <TemplatesFilter total={templates.length} filtered={filtered.length} onQueryChange={setQuery} />

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 px-6 py-12 text-center">
          <p className="text-sm font-medium">Нічого не знайдено</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Спробуйте інший запит — наприклад, «відпустка», «АКТ-01» або «довідка».
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
      )}
    </div>
  )
}
