import Link from "next/link"
import { ArrowRight, FileText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { TemplateDefinition } from "@/lib/documents/catalog"

export function TemplateCard({ template }: { template: TemplateDefinition }) {
  return (
    <Card className="group relative h-full overflow-hidden py-0 transition-shadow hover:shadow-md">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-primary opacity-0 transition-opacity group-hover:opacity-100" />
      <CardHeader className="pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-4" />
            </span>
            <div>
              <CardTitle className="text-sm">{template.title}</CardTitle>
              <div className="text-xs text-muted-foreground">{template.fields} полів</div>
            </div>
          </div>
          {template.popular && (
            <Badge variant="secondary" className="rounded-full text-[11px]">
              Популярний
            </Badge>
          )}
        </div>
        <CardDescription className="pt-1 text-sm leading-relaxed">{template.description}</CardDescription>
      </CardHeader>
      <CardFooter className="gap-2">
        <Link
          href={`/templates/${template.categorySlug}/${template.id}`}
          className={cn(buttonVariants({ size: "sm" }), "flex-1")}
        >
          Заповнити
          <ArrowRight className="size-3.5" />
        </Link>
        <Badge variant="outline" className="rounded-full text-[11px]">
          {template.paper === "А4 альбом" ? "А4 альбом" : "А4"}
        </Badge>
      </CardFooter>
    </Card>
  )
}