import Link from "next/link"
import { ArrowRight, FolderOpen } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { TemplateCategory } from "@/lib/documents/catalog"

export function CategoryCard({
  category,
  count,
}: {
  category: TemplateCategory
  count: number
}) {
  return (
    <Link href={`/templates/${category.slug}`} className="group block h-full">
      <div className="relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:bg-accent/30 hover:shadow-lg hover:shadow-primary/5">
        {/* subtle glow на hover */}
        <div className="pointer-events-none absolute -top-12 -right-12 size-36 rounded-full bg-primary/10 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />

        {/* іконка з м'яким фоном + бейдж-пілюля */}
        <div className="flex items-start justify-between">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 transition-colors group-hover:bg-primary/15">
            <FolderOpen className="size-5" />
          </span>
          <Badge
            variant="outline"
            className="rounded-full border-primary/20 bg-primary/10 px-2.5 text-[11px] font-medium text-primary"
          >
            {count} {category.countLabel}
          </Badge>
        </div>

        {/* ієрархія: чіткий заголовок, легкий підзаголовок */}
        <div className="space-y-1">
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            {category.title}
          </h3>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {category.description}
          </p>
        </div>

        {/* CTA з анімованою стрілкою */}
        <div className="mt-auto flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
          Переглянути
          <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  )
}
