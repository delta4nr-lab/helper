"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/auth"
import { orm, nowTimestamp } from "@/lib/db"
import { generateBlankDocx } from "@/lib/templates/blank-docx"
import { PAPERS } from "@/lib/templates/types"

const MAX_DOCX_SIZE = 25 * 1024 * 1024 // 25 МБ

async function requireAdmin() {
  const session = await (auth as unknown as () => Promise<{ user?: { id?: string; role?: string } } | null>)()
  return session?.user?.id && session.user.role === "ADMIN" ? session.user.id : null
}

function revalidateTemplates() {
  revalidatePath("/admin/templates")
}

const tagsSchema = z
  .array(z.string().trim().min(1).max(30))
  .max(10, "Максимум 10 тегів.")
  .default([])

const templateMetaSchema = z.object({
  title: z.string().trim().min(1, "Вкажіть назву шаблону.").max(200),
  categorySlug: z.string().trim().min(1, "Оберіть категорію."),
  description: z.string().trim().max(1000).default(""),
  tags: tagsSchema,
  paper: z.enum(PAPERS).default("А4"),
})

async function readDocxFile(file: File | null): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; message: string }> {
  if (!file || file.size === 0) {
    const bytes = await generateBlankDocx()
    return { ok: true, bytes }
  }
  if (file.size > MAX_DOCX_SIZE) {
    return { ok: false, message: "DOCX-файл завеликий (максимум 25 МБ)." }
  }
  if (!file.name.toLowerCase().endsWith(".docx")) {
    return { ok: false, message: "Стартовий файл має бути у форматі .docx." }
  }
  return { ok: true, bytes: new Uint8Array(await file.arrayBuffer()) }
}

export async function createTemplateAction(
  formData: FormData
): Promise<{ ok: boolean; message: string; id?: string }> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, message: "Недостатньо прав." }

  const meta = templateMetaSchema.safeParse({
    title: formData.get("title"),
    categorySlug: formData.get("categorySlug"),
    description: formData.get("description") ?? "",
    tags: String(formData.get("tags") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    paper: formData.get("paper") ?? "А4",
  })
  if (!meta.success) {
    return { ok: false, message: meta.error.issues[0]?.message ?? "Некоректні дані." }
  }

  const category = await orm.Category.select("slug").first({ slug: meta.data.categorySlug })
  if (!category) return { ok: false, message: "Категорію не знайдено." }

  const docx = await readDocxFile(formData.get("file") instanceof File ? (formData.get("file") as File) : null)
  if (!docx.ok) return { ok: false, message: docx.message }

  try {
    const template = await orm.Template.create({
      title: meta.data.title,
      categorySlug: meta.data.categorySlug,
      description: meta.data.description,
      tags: meta.data.tags,
      paper: meta.data.paper,
      fields: 0,
      popular: false,
      isActive: false,
      docxData: docx.bytes,
      createdById: adminId,
      createdAt: nowTimestamp(),
      updatedAt: nowTimestamp(),
    })
    revalidateTemplates()
    return { ok: true, message: "Шаблон створено.", id: template.id }
  } catch (error) {
    console.error("[TemplateCreate] failed:", error)
    return { ok: false, message: "Не вдалося створити шаблон." }
  }
}

export async function updateTemplateAction(
  id: string,
  input: unknown
): Promise<{ ok: boolean; message: string }> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, message: "Недостатньо прав." }

  const meta = templateMetaSchema.extend({
    popular: z.boolean().default(false),
    isActive: z.boolean().default(false),
  }).safeParse(input)
  if (!meta.success) {
    return { ok: false, message: meta.error.issues[0]?.message ?? "Некоректні дані." }
  }

  try {
    await orm.Template.where({ id }).update({ ...meta.data, updatedAt: nowTimestamp() })
  } catch {
    return { ok: false, message: "Не вдалося зберегти шаблон." }
  }
  revalidateTemplates()
  return { ok: true, message: "Шаблон збережено." }
}

export async function deleteTemplateAction(id: string): Promise<{ ok: boolean; message: string }> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, message: "Недостатньо прав." }

  const exportsAggregate = await orm.ExportedFile
    .where({ templateId: id })
    .aggregate((agg) => ({ count: agg.count() }))
  if (exportsAggregate.count > 0) {
    return {
      ok: false,
      message: `Шаблон не можна видалити — у користувачів є збережені документи з нього (${exportsAggregate.count}).`,
    }
  }

  try {
    await orm.Template.where({ id }).delete()
  } catch {
    return { ok: false, message: "Не вдалося видалити шаблон." }
  }
  revalidateTemplates()
  return { ok: true, message: "Шаблон видалено." }
}

// Збереження DOCX з редактора шаблонів: байти + назва з заголовка редактора.
export async function saveTemplateDocxAction(
  templateId: string,
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, message: "Недостатньо прав." }

  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Документ відсутній або порожній." }
  }
  if (file.size > MAX_DOCX_SIZE) {
    return { ok: false, message: "Документ завеликий (максимум 25 МБ)." }
  }

  const title = String(formData.get("title") ?? "").trim()
  if (!title || title.length > 200) {
    return { ok: false, message: "Вкажіть коректну назву шаблону (до 200 символів)." }
  }

  try {
    const bytes: Uint8Array<ArrayBufferLike> = new Uint8Array(await file.arrayBuffer())

    await orm.Template.where({ id: templateId }).update({
      docxData: bytes,
      title,
      updatedAt: nowTimestamp(),
    })
  } catch (error) {
    console.error("[TemplateSave] failed:", error)
    return { ok: false, message: "Не вдалося зберегти шаблон." }
  }
  revalidateTemplates()
  return { ok: true, message: "Шаблон збережено." }
}
