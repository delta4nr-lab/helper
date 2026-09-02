import Link from "next/link"
import { ChevronRight, FolderOpen } from "lucide-react"

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { TemplateCategory } from "@/lib/documents/catalog"

export function CategoryCard({ category, count }: { category: TemplateCategory; count: number }) {
  return (
    <Link href={`/templates/${category.slug}`} className="group">
      <Card className="group relative h-full overflow-hidden py-0 transition-shadow hover:shadow-md">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-primary opacity-0 transition-opacity group-hover:opacity-100" />
        <CardHeader className="gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl border bg-muted">
            <FolderOpen className="size-4" />
          </span>
          <div>
            <CardTitle className="text-[15px]">{category.title}</CardTitle>
            <CardDescription className="text-sm leading-relaxed">{category.description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-full text-[11px]">
              {count} {category.countLabel}
            </Badge>
            <span className="ml-auto flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
              Переглянути
              <ChevronRight className="size-3.5" />
            </span>
          </div>
        </CardHeader>
      </Card>
    </Link>
  )
}