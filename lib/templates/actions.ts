"use server"

import JSZip from "jszip"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/auth"
import { orm, nowTimestamp } from "@/lib/db"
import { applyTemplateMarkers } from "@/lib/templates/markers"
import { generateBlankDocx } from "@/lib/templates/blank-docx"
import { PAPERS, TEMPLATE_FIELD_TYPES } from "@/lib/templates/types"

const MAX_DOCX_SIZE = 25 * 1024 * 1024 // 25 МБ

const TEMPLATE_FIELD_TYPE_VALUES = z.enum(TEMPLATE_FIELD_TYPES)

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
// Перед записом маркери {{назва поля}} (їх вставляє панель нод) перетворюються
// на content controls — далі шаблон заповнюється звичайним чином.
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
    let bytes: Uint8Array<ArrayBufferLike> = new Uint8Array(await file.arrayBuffer())

    const fields = await orm.TemplateField
      .select("key", "label")
      .where({ templateId })
      .all()
    if (fields.length > 0) {
      try {
        const zip = await JSZip.loadAsync(bytes)
        const docFile = zip.file("word/document.xml")
        if (docFile) {
          const xml = await docFile.async("string")
          const processed = applyTemplateMarkers(xml, fields)
          if (processed !== xml) {
            zip.file("word/document.xml", processed)
            bytes = await zip.generateAsync({ type: "uint8array" })
          }
        }
      } catch {
        // Некоректний архів — зберігаємо байти як є, редактор покаже помилку парсингу
      }
    }

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

// ── Поля заповнення (TemplateField) ──────────────────────────────────────────

const templateFieldSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/, "Ключ: латиниця, цифри та _, з літери."),
  label: z.string().trim().min(1, "Вкажіть назву поля.").max(200),
  _type: TEMPLATE_FIELD_TYPE_VALUES,
  required: z.boolean().default(true),
  placeholder: z.string().trim().max(200).nullable().default(null),
})

export async function createTemplateFieldAction(
  templateId: string,
  input: unknown
): Promise<{ ok: boolean; message: string }> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, message: "Недостатньо прав." }

  const parsed = templateFieldSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Некоректні дані поля." }
  }

  const template = await orm.Template.select("id").first({ id: templateId })
  if (!template) return { ok: false, message: "Шаблон не знайдено." }

  // Назва поля — адреса маркера {{назва}}: дублікати в межах шаблону заборонені
  const siblings = await orm.TemplateField.select("key", "label").where({ templateId }).all()
  const duplicate = siblings.find(
    (field) => field.label.trim().toLowerCase() === parsed.data.label.trim().toLowerCase()
  )
  if (duplicate) {
    return { ok: false, message: `Назву «${parsed.data.label}» вже використовує поле ${duplicate.key}.` }
  }

  try {
    const last = await orm.TemplateField
      .select("sortOrder")
      .where({ templateId })
      .orderBy((field) => field.sortOrder.desc())
      .first()
    await orm.TemplateField.create({
      templateId,
      key: parsed.data.key,
      label: parsed.data.label,
      _type: parsed.data._type,
      required: parsed.data.required,
      placeholder: parsed.data.placeholder,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      createdAt: nowTimestamp(),
      updatedAt: nowTimestamp(),
    })
  } catch (error) {
    console.error("[TemplateFieldCreate] failed:", error)
    return { ok: false, message: "Поле з таким ключем уже існує або некоректні дані." }
  }
  revalidateTemplates()
  return { ok: true, message: "Поле додано." }
}

export async function updateTemplateFieldAction(
  id: string,
  input: unknown
): Promise<{ ok: boolean; message: string }> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, message: "Недостатньо прав." }

  const parsed = templateFieldSchema.omit({ key: true }).safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Некоректні дані поля." }
  }

  const field = await orm.TemplateField.select("templateId").first({ id })
  if (!field) return { ok: false, message: "Поле не знайдено." }

  // Назва — адреса маркера {{назва}}: дублікати в межах шаблону заборонені
  const siblings = await orm.TemplateField
    .select("id", "key", "label")
    .where({ templateId: field.templateId })
    .all()
  const duplicate = siblings.find(
    (sibling) =>
      sibling.id !== id &&
      sibling.label.trim().toLowerCase() === parsed.data.label.trim().toLowerCase()
  )
  if (duplicate) {
    return {
      ok: false,
      message: `Назву «${parsed.data.label}» вже використовує поле ${duplicate.key}.`,
    }
  }

  try {
    await orm.TemplateField.where({ id }).update({
      label: parsed.data.label,
      _type: parsed.data._type,
      required: parsed.data.required,
      placeholder: parsed.data.placeholder,
      updatedAt: nowTimestamp(),
    })
  } catch {
    return { ok: false, message: "Не вдалося зберегти поле." }
  }
  revalidateTemplates()
  return { ok: true, message: "Поле збережено." }
}

export async function deleteTemplateFieldAction(
  id: string
): Promise<{ ok: boolean; message: string }> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, message: "Недостатньо прав." }

  try {
    await orm.TemplateField.where({ id }).delete()
  } catch {
    return { ok: false, message: "Не вдалося видалити поле." }
  }
  revalidateTemplates()
  return { ok: true, message: "Поле видалено." }
}

// Переміщення поля вгору/вниз: обмін sortOrder із сусідом
export async function moveTemplateFieldAction(
  id: string,
  direction: "up" | "down"
): Promise<{ ok: boolean; message: string }> {  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, message: "Недостатньо прав." }

  try {
    const field = await orm.TemplateField.first({ id })
    if (!field) return { ok: false, message: "Поле не знайдено." }

    const siblings = await orm.TemplateField
      .select("id", "sortOrder")
      .where({ templateId: field.templateId })
      .orderBy((f) => f.sortOrder.asc())
      .all()
    const index = siblings.findIndex((sibling) => sibling.id === id)
    const neighborIndex = direction === "up" ? index - 1 : index + 1
    if (index === -1 || neighborIndex < 0 || neighborIndex >= siblings.length) {
      return { ok: true, message: "Поле вже на краю списку." }
    }

    const neighbor = siblings[neighborIndex]
    await orm.TemplateField.where({ id: field.id }).update({ sortOrder: neighbor.sortOrder, updatedAt: nowTimestamp() })
    await orm.TemplateField.where({ id: neighbor.id }).update({ sortOrder: field.sortOrder, updatedAt: nowTimestamp() })
  } catch {
    return { ok: false, message: "Не вдалося перемістити поле." }
  }
  revalidateTemplates()
  return { ok: true, message: "Порядок змінено." }
}

// Upsert поля за ключем: викликається після вставки ноди з панелі заготовок,
// щоб діалог «Поля заповнення» і БД завжди відповідали вмісту документа.
export async function ensureTemplateFieldAction(
  templateId: string,
  input: { key: string; label: string; _type: string }
): Promise<{ ok: boolean; message: string }> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, message: "Недостатньо прав." }

  const parsed = z
    .object({
      key: z.string().trim().min(1).max(64),
      label: z.string().trim().min(1).max(200),
      _type: z.string().trim().min(1).max(64),
    })
    .safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Некоректні дані ноди." }
  }

  try {
    const existing = await orm.TemplateField
      .select("id")
      .first({ templateId, key: parsed.data.key })
    if (existing) {
      await orm.TemplateField.where({ id: existing.id }).update({
        label: parsed.data.label,
        _type: parsed.data._type,
        updatedAt: nowTimestamp(),
      })
      revalidateTemplates()
      return { ok: true, message: "Поле оновлено." }
    }
    const last = await orm.TemplateField
      .select("sortOrder")
      .where({ templateId })
      .orderBy((field) => field.sortOrder.desc())
      .first()
    await orm.TemplateField.create({
      templateId,
      key: parsed.data.key,
      label: parsed.data.label,
      _type: parsed.data._type,
      required: false,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      createdAt: nowTimestamp(),
      updatedAt: nowTimestamp(),
    })
  } catch (error) {
    console.error("[TemplateFieldEnsure] failed:", error)
    return { ok: false, message: "Не вдалося зберегти поле ноди." }
  }
  revalidateTemplates()
  return { ok: true, message: "Поле додано." }
}
