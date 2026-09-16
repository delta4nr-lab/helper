import { NextResponse } from "next/server"

import { orm } from "@/lib/db"

type Params = { templateId: string }

// Публічна роздача DOCX активного шаблона для прев'ю на головній сторінці.
// Шаблони — адмінські файли без персональних даних; згенеровані документи
// (ExportedFile) тут не видаються. Існуючий /api/templates/[id]/docx із
// авторизацією не змінюється.
export async function GET(
  _request: Request,
  { params }: { params: Promise<Params> }
) {
  const { templateId } = await params
  const template = await orm.Template.select("docxData").first({
    id: templateId,
    isActive: true,
  })
  if (!template?.docxData) {
    return NextResponse.json(
      { message: "Шаблон не знайдено або для нього немає DOCX-файлу." },
      { status: 404 }
    )
  }

  return new NextResponse(Buffer.from(template.docxData), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'inline; filename="template.docx"',
      "Cache-Control": "public, max-age=600",
    },
  })
}
