import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { createDocxBuffer } from "@/lib/documents/export/docx"
import { validateDocumentData } from "@/lib/documents/registry"
import { raportVidpustkaTitle } from "@/lib/documents/schemas/raport-vidpustka"
import { raportVidryadzhennyaTitle } from "@/lib/documents/schemas/raport-vidryadzhennya"

type Params = { templateId: string }

function safeFileName(value: string): string {
  return `${value.replace(/[^\p{L}\p{N}\s-]/gu, "").trim() || "document"}.docx`
}

export async function POST(request: Request, { params }: { params: Promise<Params> }) {
  const session = await (auth as unknown as () => Promise<{ user?: { id?: string } } | null>)()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ message: "Не авторизовано. Увійдіть у систему." }, { status: 401 })

  const { templateId } = await params
  const template = await prisma.template.findUnique({
    where: { id: templateId, isActive: true },
    include: { fieldsConfig: { orderBy: { sortOrder: "asc" } } },
  })
  if (!template) return NextResponse.json({ message: "Шаблон не знайдено або деактивовано." }, { status: 404 })

  let body: { data?: Record<string, unknown> }
  try {
    body = await request.json() as { data?: Record<string, unknown> }
  } catch {
    return NextResponse.json({ message: "Невірні дані форми." }, { status: 400 })
  }

  const rawData = body.data ?? {}
  const validation = validateDocumentData(templateId, rawData)
  if (!validation.success) {
    return NextResponse.json({ message: validation.error.issues[0]?.message ?? "Перевірте дані форми." }, { status: 400 })
  }
  const data = validation.data as Record<string, unknown>

  let personnelLabel: string | undefined
  if (typeof data.personnelId === "string" && data.personnelId) {
    const personnel = await prisma.personnel.findUnique({ where: { id: data.personnelId } })
    if (!personnel) return NextResponse.json({ message: "Обраного військовослужбовця не знайдено." }, { status: 400 })
    personnelLabel = [personnel.lastName, personnel.firstName, personnel.middleName].filter(Boolean).join(" ")
    data.personnelName = personnelLabel
  }

  const title = templateId === "raport-vidpustka"
    ? raportVidpustkaTitle(data as never, personnelLabel)
    : templateId === "raport-vidryadzhennya"
      ? raportVidryadzhennyaTitle(data as never, personnelLabel)
      : `${template.title} — ${new Date().toLocaleDateString("uk-UA")}`
  const fileName = safeFileName(title)
  let buffer: Buffer
  let exportedFile: { id: string }
  try {
    buffer = await createDocxBuffer({ title, header: template.headerTemplate, body: template.bodyTemplate, footer: template.footerTemplate, data, paper: (template as unknown as { paper?: string | null }).paper ?? "А4" })
    exportedFile = await prisma.exportedFile.create({
      data: { userId, templateId, title, fileName, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: buffer.length, data: new Uint8Array(buffer) },
      select: { id: true },
    })
  } catch {
    return NextResponse.json({ message: "Не вдалося сформувати DOCX-файл. Перевірте шаблон і спробуйте ще раз." }, { status: 500 })
  }

  return NextResponse.json({ id: exportedFile.id, fileName, downloadUrl: `/api/exports/${exportedFile.id}` })
}
