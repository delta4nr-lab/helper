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
    .include("templateFields", (field) => field.orderBy((f) => f.sortOrder.asc()))
    .first()
  if (!template) notFound()

  const personnel = await orm.Personnel.orderBy((p) => p.lastName.asc()).limit(500).all()

  const fields = (template.templateFields ?? []).map((field) => ({
    id: String(field.id),
    key: String(field.key),
    label: String(field.label),
    _type: String((field as unknown as { _type?: string })._type ?? "text"),
    required: Boolean(field.required),
    placeholder: field.placeholder ? String(field.placeholder) : null,
    sortOrder: Number((field as unknown as { sortOrder?: number }).sortOrder ?? 0),
  }))

  return (
    <div className="min-h-svh bg-muted/20">
      <SiteHeader />
      <div className="mx-auto flex max-w-[1440px] items-start">
        <AdminSidebar />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold tracking-tight">Редактор шаблона</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Редагуйте документ, додавайте content controls під поля заповнення та зберігайте шаблон.
          </p>
          <div className="mt-4">
            <TemplateEditorScreen
              templateId={template.id}
              title={template.title}
              fields={fields}
              personnel={personnel.map((person) => ({
                id: person.id,
                lastName: person.lastName,
                firstName: person.firstName,
                middleName: person.middleName,
                rank: person.rank,
                position: person.position,
                signaturePath: person.signaturePath,
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
