import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { orm } from "@/lib/db"

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const MAX_FILE_SIZE = 25 * 1024 * 1024

function safeFileName(value: string): string {
  return `${value.replace(/[^\p{L}\p{N}\s-]/gu, "").trim() || "document"}.docx`
}

// Зберігає DOCX, згенерований редактором у браузері, до історії експортів користувача.
// Приймає FormData: templateId, title, file (DOCX-байти).
export async function POST(request: Request) {
  const session = await (auth as unknown as () => Promise<{ user?: { id?: string } } | null>)()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ message: "Не авторизовано. Увійдіть у систему." }, { status: 401 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ message: "Невірні дані." }, { status: 400 })
  }

  const templateId = typeof form.get("templateId") === "string" ? (form.get("templateId") as string) : ""
  const title = typeof form.get("title") === "string" ? (form.get("title") as string).slice(0, 300) : ""
  const file = form.get("file")
  if (!templateId || !title || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ message: "Не передано файл або назву документа." }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ message: "Файл задований (максимум 25 МБ)." }, { status: 413 })
  }

  const template = await orm.Template.select("id").first({ id: templateId })
  if (!template) return NextResponse.json({ message: "Шаблон не знайдено." }, { status: 404 })

  const data = new Uint8Array(await file.arrayBuffer())
  const fileName = safeFileName(title)

  const exported = await orm.ExportedFile.select("id").create({
    userId,
    templateId,
    title,
    fileName,
    mimeType: DOCX_MIME,
    size: data.length,
    data,
  })

  return NextResponse.json({ id: exported.id, fileName, downloadUrl: `/api/exports/${exported.id}` })
}
