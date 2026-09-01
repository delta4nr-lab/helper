import { notFound } from "next/navigation"

import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { TemplateForm } from "@/app/admin/templates/new/template-form"
import { orm } from "@/lib/db"

type Params = { templateId: string }

export const dynamic = "force-dynamic"

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<Params>
}) {
  const { templateId } = await params
  const [template, categories] = await Promise.all([
    orm.Template.first({ id: templateId }),
    orm.Category.where({ isActive: true })
      .orderBy((c) => c.sortOrder.asc())
      .select("slug", "title")
      .all(),
  ])
  if (!template) notFound()
  return (
    <div className="min-h-svh bg-muted/20">
      <SiteHeader />
      <div className="mx-auto flex max-w-[1440px] items-start">
        <AdminSidebar />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            Редагування шаблону
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Зміни застосуються до наступних експортів.
          </p>
          <TemplateForm
            mode="edit"
            templateId={template.id}
            initial={{
              title: template.title,
              categorySlug: template.categorySlug,
              description: template.description,
              header: template.headerTemplate ?? "",
              body: template.bodyTemplate ?? "",
              footer: template.footerTemplate ?? "",
              paper: (template as unknown as { paper?: string }).paper ?? "А4",
            }}
            categories={categories}
          />
        </main>
      </div>
      <SiteFooter />
    </div>
  )
}
