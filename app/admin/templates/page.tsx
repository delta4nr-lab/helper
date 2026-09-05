import { TemplateManager } from "@/components/admin/template-manager"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { orm } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function AdminTemplatesPage() {
  const templates = await orm.Template
    .select(
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
    .include("templateFields", (field) => field.count())
    .orderBy((template) => template.updatedAt.desc())
    .all()

  const categories = await orm.Category.select("slug", "title")
    .orderBy((category) => category.title.asc())
    .all()

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
    fieldsCount:
      typeof template.templateFields === "number" ? template.templateFields : 0,
  }))

  return (
    <div className="min-h-svh bg-muted/20">
      <SiteHeader />
      <div className="mx-auto flex max-w-[1440px] items-start">
        <AdminSidebar />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold tracking-tight">Шаблони документів</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Створення шаблонів у редакторі, керування метаданими, полями заповнення та видимістю на сайті.
          </p>
          <TemplateManager templates={rows} categories={categories} />
        </main>
      </div>
      <SiteFooter />
    </div>
  )
}
