import Link from "next/link"
import { ArrowRight, Eye, FileText } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { TemplateDefinition } from "@/lib/documents/catalog"

export function TemplateCard({ template }: { template: TemplateDefinition }) {
  return (
    <Card className="group flex h-full flex-col overflow-hidden py-0">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-primary opacity-0 transition-opacity group-hover:opacity-100" />
      <CardHeader className="gap-2 p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="size-4" />
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {template.popular && (
              <Badge variant="secondary" className="rounded-full text-[11px]">
                Популярний
              </Badge>
            )}
            <Badge variant="outline" className="rounded-full text-[11px]">
              {template.paper}
            </Badge>
          </div>
        </div>
        <CardTitle className="line-clamp-2 text-[14px] leading-snug">{template.title}</CardTitle>
        <div className="text-xs text-muted-foreground">
          {template.fields} полів · оновлено {template.updatedAt}
        </div>
        <CardDescription className="line-clamp-2 text-sm leading-relaxed">{template.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-wrap gap-1.5 p-4 pt-2">
        {template.tags.map((tag) => (
          <Badge key={tag} variant="outline" className="rounded-full text-[11px]">
            {tag}
          </Badge>
        ))}
      </CardContent>

      <CardFooter className="mt-auto gap-2 p-4 pt-0">
        <Link
          href={`/templates/${template.categorySlug}/${template.id}`}
          className={cn(buttonVariants({ size: "sm" }), "flex-1")}
        >
          Створити
          <ArrowRight className="size-3.5" />
        </Link>
        <Link
          href={`/templates/${template.categorySlug}/${template.id}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-1")}
        >
          <Eye className="size-3.5" />
          Перегляд
        </Link>
      </CardFooter>
    </Card>
  )
}
