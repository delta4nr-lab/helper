import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { orm } from "@/lib/db"

type Params = { templateId: string }

// DOCX шаблона для адмінського редактора: читається незалежно від isActive
// (щоб редагувати ще неактивні шаблони), на відміну від публічного
// /api/templates/[templateId]/docx.
export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await (auth as unknown as () => Promise<{ user?: { id?: string; role?: string } } | null>)()
  const user = session?.user as unknown as { role?: string; isActive?: boolean } | undefined
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Не авторизовано. Увійдіть у систему." }, { status: 401 })
  }
  if (user?.role !== "ADMIN" || user.isActive === false) {
    return NextResponse.json({ message: "Недостатньо прав." }, { status: 403 })
  }

  const { templateId } = await params
  const template = await orm.Template.select("docxData").first({ id: templateId })
  if (!template?.docxData) {
    return NextResponse.json({ message: "Для шаблона немає DOCX-файлу." }, { status: 404 })
  }

  return new NextResponse(Buffer.from(template.docxData), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": 'inline; filename="template.docx"',
      "Cache-Control": "private, no-store",
    },
  })
}
