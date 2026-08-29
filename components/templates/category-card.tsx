import Link from "next/link"
import {
  ArrowRight,
  FileText,
  ScrollText,
  BadgeCheck,
  Table2,
  ClipboardCheck,
  Mail,
} from "lucide-react"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { TemplateCategory } from "@/lib/documents/catalog"

const iconMap = {
  raporty: FileText,
  nakazy: ScrollText,
  dovidky: BadgeCheck,
  zhurnaly: Table2,
  akty: ClipboardCheck,
  lystuvannya: Mail,
} as const

export function CategoryCard({
  category,
  count,
}: {
  category: TemplateCategory
  count: number
}) {
  const Icon = iconMap[category.icon as keyof typeof iconMap] ?? FileText
  return (
    <Link href={`/templates/${category.slug}`} className="group">
      <Card className="h-full gap-0 overflow-hidden border bg-card py-0 transition-all hover:border-primary/30 hover:shadow-md">
        <CardHeader className="gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="size-5" />
            </span>
            <Badge variant="secondary" className="rounded-full text-xs">
              {count} {category.countLabel}
            </Badge>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-[16px] leading-tight">
              {category.title}
            </CardTitle>
            <CardDescription className="line-clamp-2 text-sm leading-relaxed">
              {category.description}
            </CardDescription>
          </div>
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {category.longDescription}
          </p>
          <div className="flex items-center gap-1 pt-1 text-sm font-medium text-primary">
            Перейти до шаблонів
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </CardHeader>
      </Card>
    </Link>
  )
}
