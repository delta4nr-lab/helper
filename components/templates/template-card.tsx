import Link from "next/link"
import { ArrowRight, FileText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { TemplateDefinition } from "@/lib/documents/catalog"

// Картка шаблону в стилі CategoryCard (soft-іконка, pill-бейджі, hover-підйом
// із glow, CTA з анімованою стрілкою). categoryTitle — опційний бейдж
// категорії (головна передає його з БД; сторінка категорії — ні).

export function TemplateCard({
  template,
  categoryTitle = null,
}: {
  template: TemplateDefinition
  categoryTitle?: string | null
}) {
  return (
    <Link
      href={`/templates/${template.categorySlug}/${template.id}`}
      className="group block h-full"
    >
      <div className="relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-accent/30 hover:shadow-lg hover:shadow-primary/5">
        {/* subtle glow на hover */}
        <div className="pointer-events-none absolute -top-12 -right-12 size-36 rounded-full bg-primary/10 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />

        <div className="flex items-start justify-between gap-2">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 transition-colors group-hover:bg-primary/15">
            <FileText className="size-5" />
          </span>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {categoryTitle && (
              <Badge className="rounded-full border-primary/20 bg-primary/10 px-2.5 text-[11px] font-medium text-primary">
                {categoryTitle}
              </Badge>
            )}
            {template.popular && (
              <Badge variant="secondary" className="rounded-full text-[11px]">
                Популярний
              </Badge>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            {template.title}
          </h3>
          <p className="line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
            {template.description}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
          <span>{template.fields} полів</span>
          <span>{template.paper === "А4 альбом" ? "А4 альбом" : "А4"}</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
          Заповнити
          <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  )
}
