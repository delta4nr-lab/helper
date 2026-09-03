import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { orm } from "@/lib/db"

type Params = { templateId: string }

// Віддає DOCX-шаблон (OOXML з content controls) авторизованому клієнту.
// Файл зберігається в БД (Template.docxData), тому не доступний з public/.
export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await (auth as unknown as () => Promise<{ user?: { id?: string } } | null>)()
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Не авторизовано. Увійдіть у систему." }, { status: 401 })
  }

  const { templateId } = await params
  const template = await orm.Template.select("docxData").first({ id: templateId, isActive: true })
  if (!template?.docxData) {
    return NextResponse.json({ message: "Шаблон не знайдено або для нього немає DOCX-файлу." }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(template.docxData), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'inline; filename="template.docx"',
      "Cache-Control": "private, no-store",
    },
  })
}
