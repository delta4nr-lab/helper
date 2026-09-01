import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"
import { load } from "cheerio"

import { auth } from "@/auth"
import { orm } from "@/lib/db"
import { createDocxBuffer, type SignatureImage } from "@/lib/documents/export/docx"

type Params = { templateId: string }

function safeFileName(value: string): string {
  return `${value.replace(/[^\p{L}\p{N}\s-]/gu, "").trim() || "document"}.docx`
}

function mimeFromPath(filePath: string): string {
  if (filePath.endsWith(".png")) return "image/png"
  if (filePath.endsWith(".webp")) return "image/webp"
  return "image/jpeg"
}

// Редагування відбувається прямо в документі (tip-tap), тому експорт отримує готовий HTML.
// Підписи: signature-поля з обраною особою (data-person-id) → вбудовуємо зображення підпису зі штату.
export async function POST(request: Request, { params }: { params: Promise<Params> }) {
  const session = await (auth as unknown as () => Promise<{ user?: { id?: string } } | null>)()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ message: "Не авторизовано. Увійдіть у систему." }, { status: 401 })

  const { templateId } = await params
  const template = await orm.Template.first({ id: templateId })
  if (!template) return NextResponse.json({ message: "Шаблон не знайдено." }, { status: 404 })

  let body: { html?: string }
  try {
    body = (await request.json()) as { html?: string }
  } catch {
    return NextResponse.json({ message: "Невірні дані." }, { status: 400 })
  }
  const html = typeof body?.html === "string" ? body.html : ""
  if (!html.trim()) return NextResponse.json({ message: "Документ порожній." }, { status: 400 })

  const $ = load(html, null, false)
  const sigSpans = $('span[data-fill-type="signature"]').toArray()
  const personIds = Array.from(
    new Set(
      sigSpans
        .map((el) => $(el).attr("data-person-id"))
        .filter((v): v is string => Boolean(v))
    )
  )
  const persons = personIds.length > 0 ? await orm.Personnel.where((p) => p.id.in(personIds)).all() : []
  const personsById = new Map(persons.map((p) => [p.id, p]))

  const signatureImages: Record<string, SignatureImage> = {}
  const nameByKey = new Map<string, string>()
  const imageLoads: Promise<void>[] = []
  for (const el of sigSpans) {
    const $el = $(el)
    const key = $el.attr("data-fill-key")
    const personId = $el.attr("data-person-id")
    if (!key || !personId) continue
    const person = personsById.get(personId)
    if (!person) continue
    const name = [person.firstName, person.middleName, person.lastName].filter(Boolean).join(" ")
    nameByKey.set(key, name)
    if (person.signaturePath && !person.signaturePath.endsWith(".webp")) {
      imageLoads.push(
        (async () => {
          try {
            const rel = person.signaturePath!.replace(/^\//, "")
            const buffer = await readFile(path.join(process.cwd(), "public", rel))
            signatureImages[key] = { name, buffer, mime: mimeFromPath(person.signaturePath!) }
          } catch {
            // файл відсутній — лишаємо лише ім'я
          }
        })()
      )
    }
  }
  await Promise.all(imageLoads)

  // Замінюємо span підпису: обрана особа → <img data-sig> (лише зображення, без ПІБ),
  // інакше — прибираємо span (порожній підпис не потрапляє в документ).
  sigSpans.forEach((el) => {
    const $el = $(el)
    const key = $el.attr("data-fill-key")
    if (!key || !nameByKey.has(key)) return
    if (signatureImages[key]) $el.replaceWith($(`<img data-sig="${key}" />`))
    else $el.remove()
  })
  // Прибираємо залишкові елементи редактора: zero-width слот підпису та зображення
  $("span[data-signature]").remove()
  $("img[data-signature]").remove()

  const processedHtml = $.html()

  const title = `${template.title} — ${new Date().toLocaleDateString("uk-UA")}`
  const fileName = safeFileName(title)

  let buffer: Buffer
  try {
    buffer = await createDocxBuffer({
      title,
      header: "",
      body: processedHtml,
      footer: "",
      data: {},
      paper: template.paper,
      signatureImages,
    })
  } catch {
    return NextResponse.json({ message: "Не вдалося сформувати DOCX-файл. Перевірте шаблон і спробуйте ще раз." }, { status: 500 })
  }

  const exportedFile = await orm.ExportedFile.select("id").create({
    userId,
    templateId,
    title,
    fileName,
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: buffer.length,
    data: new Uint8Array(buffer),
  })

  return NextResponse.json({ id: exportedFile.id, fileName, downloadUrl: `/api/exports/${exportedFile.id}` })
}