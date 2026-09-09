import { notFound } from "next/navigation"

import { TemplateEditorScreen } from "@/components/admin/template-editor-screen"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { orm } from "@/lib/db"
import { saveTemplateDocxAction } from "@/lib/templates/actions"

export const dynamic = "force-dynamic"

export default async function AdminTemplateEditorPage({
  params,
}: {
  params: Promise<{ templateId: string }>
}) {
  const { templateId } = await params

  const template = await orm.Template
    .where({ id: templateId })
    .first()
  if (!template) notFound()

  // Довідник персоналу для персональних полів (панель у template-режимі)
  const personnel = await orm.Personnel
    .select(
      "id",
      "lastName",
      "firstName",
      "middleName",
      "rank",
      "position",
      "signaturePath"
    )
    .orderBy((p) => p.lastName.asc())
    .limit(500)
    .all()

  return (
    <div className="min-h-svh bg-muted/20">
      <SiteHeader />
      <div className="mx-auto flex max-w-[1440px] items-start">
        <AdminSidebar />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold tracking-tight">Редактор шаблона</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Редагуйте документ та зберігайте шаблон.
          </p>
          <div className="mt-4">
            <TemplateEditorScreen
              templateId={template.id}
              title={template.title}
              personnel={personnel.map((p) => ({
                id: p.id,
                fullName: [p.lastName, p.firstName, p.middleName].filter(Boolean).join(" "),
                rank: p.rank,
                position: p.position,
                signaturePath: p.signaturePath ?? null,
              }))}
              saveHandler={saveTemplateDocxAction.bind(null, template.id)}
            />
          </div>
        </main>
      </div>
      <SiteFooter />
    </div>
  )
}
