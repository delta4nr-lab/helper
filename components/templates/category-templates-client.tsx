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
      const haystack = [t.title, t.id, t.description, ...t.tags].join(" ").toLowerCase()
      return haystack.includes(q)
    })
  }, [templates, query])

  return (
    <div className="space-y-4">
      <TemplatesFilter total={templates.length} filtered={filtered.length} onQueryChange={setQuery} />
      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Нічого не знайдено за запитом «{query}».
        </p>
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