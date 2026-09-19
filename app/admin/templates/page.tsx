import { TemplateManager } from "@/components/admin/template-manager"
import { orm } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function AdminTemplatesPage() {
  const [templates, categories] = await Promise.all([
    orm.Template.select(
      "id",
      "title",
      "categorySlug",
      "description",
      "tags",
      "paper",
      "isActive",
      "popular",
      "updatedAt"
    )
      .orderBy((template) => template.updatedAt.desc())
      .all(),
    orm.Category.select("slug", "title")
      .orderBy((category) => category.title.asc())
      .all(),
  ])

  const rows = templates.map((template) => ({
    id: template.id,
    title: template.title,
    categorySlug: template.categorySlug,
    description: template.description,
    tags: (template.tags ?? []) as string[],
    paper: String(template.paper),
    isActive: template.isActive,
    popular: template.popular,
    updatedAt: String(template.updatedAt),
  }))

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        Шаблони документів
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Створення шаблонів у редакторі, керування метаданими, полями заповнення
        та видимістю на сайті.
      </p>
      <TemplateManager templates={rows} categories={categories} />
    </>
  )
}
