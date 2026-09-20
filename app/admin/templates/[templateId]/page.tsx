import { notFound } from "next/navigation"

import { TemplateEditorScreen } from "@/components/admin/template-editor-screen"
import { orm } from "@/lib/db"
import { saveTemplateDocxAction } from "@/lib/templates/actions"

export const dynamic = "force-dynamic"

export default async function AdminTemplateEditorPage({
  params,
}: {
  params: Promise<{ templateId: string }>
}) {
  const { templateId } = await params

  const template = await orm.Template.select("id", "title").first({
    id: templateId,
  })
  if (!template) notFound()

  return (
    <>
     
      <div>
        <TemplateEditorScreen
          templateId={template.id}
          title={template.title}
          saveHandler={saveTemplateDocxAction.bind(null, template.id)}
        />
      </div>
    </>
  )
}
