import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { TemplateManager } from "@/components/admin/template-manager"
import { orm } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function AdminTemplatesPage() {
  const templates = await orm.Template.include("category", (c) => c.select("title"))
    .orderBy((t) => t.updatedAt.desc())
    .all()
  return (
    <div className="min-h-svh bg-muted/20">
      <SiteHeader />
      <div className="mx-auto flex max-w-[1440px] items-start">
        <AdminSidebar />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold tracking-tight">Шаблони</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Керуйте шаблонами, які доступні користувачам у каталозі.
          </p>
          <TemplateManager
            initialTemplates={templates.map((template) => ({
              id: template.id,
              title: template.title,
              categorySlug: template.categorySlug,
              categoryTitle: template.category?.title ?? template.categorySlug,
              description: template.description,
              fields: template.fields,
              isActive: template.isActive,
              updatedAt: template.updatedAt,
            }))}
          />
        </main>
      </div>
      <SiteFooter />
    </div>
  )
}
