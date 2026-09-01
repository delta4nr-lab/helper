"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { db, orm, nowTimestamp } from "@/lib/db"
import { slugify } from "@/lib/slugify"

type TemplateActionResult = { ok: boolean; message: string; templateId?: string }

type TemplateMutation = {
  title: string
  categorySlug: string
  description: string
  headerTemplate: string
  bodyTemplate: string
  footerTemplate: string
  paper?: string
}

async function requireAdmin() {
  const session = await (auth as unknown as () => Promise<{ user?: { id?: string; role?: string } } | null>)()
  return session?.user?.id && session.user.role === "ADMIN" ? session.user.id : null
}

// Видобуває поля (key + label + type) з вмісту шаблону. Label береться з data-label,
// type — з data-field-type (text | signature | person | position), інакше fallback на key/"text".
function fieldEntries(data: TemplateMutation): { key: string; label: string; type: string }[] {
  const content = `${data.headerTemplate}\n${data.bodyTemplate}\n${data.footerTemplate}`
  const entries: { key: string; label: string; type: string }[] = []
  const seen = new Set<string>()

  // Поля, вставлені через редактор: <span data-field-key="..." data-label="..." data-field-type="...">
  const spanRe = /<span\b[^>]*data-field-key=["'](\w+)["'][^>]*>[\s\S]*?<\/span>/gi
  for (const match of content.matchAll(spanRe)) {
    const key = match[1]
    if (seen.has(key)) continue
    seen.add(key)
    const labelMatch = match[0].match(/data-label=["']([^"']*)["']/)
    const typeMatch = match[0].match(/data-field-type=["'](\w+)["']/)
    entries.push({ key, label: labelMatch ? labelMatch[1] : key, type: typeMatch ? typeMatch[1] : "text" })
  }

  // Інші посилання на ключі: {{key}} або data-field-key без span
  for (const match of content.matchAll(/\{\{(\w+)\}\}/g)) {
    const key = match[1]
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({ key, label: key, type: "text" })
  }
  for (const match of content.matchAll(/data-field-key=["'](\w+)["']/g)) {
    const key = match[1]
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({ key, label: key, type: "text" })
  }

  return entries
}

export async function createTemplateAction(data: {
  title: string
  categorySlug: string
  description: string
  headerTemplate: string
  bodyTemplate: string
  footerTemplate: string
  paper?: string
}): Promise<TemplateActionResult> {
  const userId = await requireAdmin()
  if (!userId) return { ok: false, message: "Недостатньо прав" }

  const title = data.title.trim()
  if (!title) return { ok: false, message: "Вкажіть назву шаблону" }
  const baseId = slugify(title)
  if (!baseId) return { ok: false, message: "Не вдалося сформувати slug із назви шаблону" }

  let id = baseId
  let suffix = 2
  while (await orm.Template.select("id").first({ id })) {
    id = `${baseId}-${suffix}`
    suffix += 1
  }

  const category = await orm.Category.first({ slug: data.categorySlug })
  if (!category) return { ok: false, message: "Категорію не знайдено" }

  const keys = fieldEntries(data)

  const paper = data.paper === "А4 альбом" ? "А4 альбом" : "А4"
  try {
    await orm.Template.create({
      id,
      categoryId: category.id,
      categorySlug: category.slug,
      title,
      fields: keys.length,
      description: data.description.trim(),
      tags: [],
      paper,
      headerTemplate: data.headerTemplate,
      bodyTemplate: data.bodyTemplate,
      footerTemplate: data.footerTemplate,
      createdById: userId,
      updatedAt: nowTimestamp(),
      templateFields: (fields) =>
        fields.create(keys.map((field, sortOrder) => ({ key: field.key, label: field.label, _type: field.type, sortOrder, updatedAt: nowTimestamp() }))),
    })
  } catch {
    return { ok: false, message: "Не вдалося створити шаблон. Спробуйте ще раз." }
  }

  revalidatePath(`/templates/${category.slug}`)
  revalidatePath("/templates")
  return { ok: true, message: "Шаблон створено", templateId: id }
}

export async function updateTemplateAction(templateId: string, data: TemplateMutation): Promise<TemplateActionResult> {
  const userId = await requireAdmin()
  if (!userId) return { ok: false, message: "Недостатньо прав" }
  const title = data.title.trim()
  if (!title) return { ok: false, message: "Вкажіть назву шаблону" }
  const category = await orm.Category.first({ slug: data.categorySlug })
  if (!category) return { ok: false, message: "Категорію не знайдено" }
  const keys = fieldEntries(data)

  const paper = data.paper === "А4 альбом" ? "А4 альбом" : "А4"
  try {
    await db.transaction(async (tx) => {
      await tx.orm.public.Template.where({ id: templateId }).update({
        categoryId: category.id,
        categorySlug: category.slug,
        title,
        description: data.description.trim(),
        headerTemplate: data.headerTemplate,
        bodyTemplate: data.bodyTemplate,
        footerTemplate: data.footerTemplate,
        paper,
        fields: keys.length,
        updatedAt: nowTimestamp(),
      })
      await tx.orm.public.TemplateField.where({ templateId }).deleteAll()
      if (keys.length) {
        await tx.orm.public.TemplateField.createAndCount(
          keys.map((field, sortOrder) => ({ templateId, key: field.key, label: field.label, _type: field.type, sortOrder, updatedAt: nowTimestamp() }))
        )
      }
    })
  } catch {
    return { ok: false, message: "Не вдалося оновити шаблон. Перевірте дані та спробуйте ще раз." }
  }

  revalidatePath("/templates")
  revalidatePath(`/templates/${category.slug}`)
  revalidatePath(`/templates/${category.slug}/${templateId}`)
  revalidatePath("/admin/templates")
  return { ok: true, message: "Шаблон оновлено", templateId }
}

export async function deleteTemplateAction(templateId: string): Promise<TemplateActionResult> {
  const userId = await requireAdmin()
  if (!userId) return { ok: false, message: "Недостатньо прав" }
  const template = await orm.Template.include("exportedFiles", (ef) => ef.count()).first({ id: templateId })
  if (!template) return { ok: false, message: "Шаблон не знайдено" }

  try {
    if (template.exportedFiles > 0) {
      await orm.Template.where({ id: templateId }).update({ isActive: false, updatedAt: nowTimestamp() })
      revalidatePath("/templates")
      revalidatePath(`/templates/${template.categorySlug}`)
      revalidatePath("/admin/templates")
      return { ok: true, message: "Шаблон деактивовано: він має збережені експорти." }
    }
    await orm.Template.where({ id: templateId }).delete()
  } catch {
    return { ok: false, message: "Не вдалося видалити шаблон." }
  }
  revalidatePath("/templates")
  revalidatePath(`/templates/${template.categorySlug}`)
  revalidatePath("/admin/templates")
  return { ok: true, message: "Шаблон видалено" }
}