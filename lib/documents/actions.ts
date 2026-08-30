"use server"

import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
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
  while (await prisma.template.findUnique({ where: { id }, select: { id: true } })) {
    id = `${baseId}-${suffix}`
    suffix += 1
  }

  const category = await prisma.category.findUnique({ where: { slug: data.categorySlug } })
  if (!category) return { ok: false, message: "Категорію не знайдено" }

  const keys = fieldEntries(data)

  const paper = data.paper === "А4 альбом" ? "А4 альбом" : "А4"
  try {
    await prisma.template.create({
      data: {
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
        fieldsConfig: { create: keys.map((field, sortOrder) => ({ key: field.key, label: field.label, type: field.type, sortOrder })) },
      },
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
  const category = await prisma.category.findUnique({ where: { slug: data.categorySlug } })
  if (!category) return { ok: false, message: "Категорію не знайдено" }
  const keys = fieldEntries(data)

  const paper = data.paper === "А4 альбом" ? "А4 альбом" : "А4"
  try {
    await prisma.$transaction(async (tx) => {
      await tx.template.update({
        where: { id: templateId },
        data: { categoryId: category.id, categorySlug: category.slug, title, description: data.description.trim(), headerTemplate: data.headerTemplate, bodyTemplate: data.bodyTemplate, footerTemplate: data.footerTemplate, paper, fields: keys.length },
      })
      await tx.templateField.deleteMany({ where: { templateId } })
      if (keys.length) await tx.templateField.createMany({ data: keys.map((field, sortOrder) => ({ templateId, key: field.key, label: field.label, type: field.type, sortOrder })) })
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
  const template = await prisma.template.findUnique({ where: { id: templateId }, include: { _count: { select: { exportedFiles: true } } } })
  if (!template) return { ok: false, message: "Шаблон не знайдено" }

  try {
    if (template._count.exportedFiles > 0) {
      await prisma.template.update({ where: { id: templateId }, data: { isActive: false } })
      revalidatePath("/templates")
      revalidatePath(`/templates/${template.categorySlug}`)
      revalidatePath("/admin/templates")
      return { ok: true, message: "Шаблон деактивовано: він має збережені експорти." }
    }
    await prisma.template.delete({ where: { id: templateId } })
  } catch {
    return { ok: false, message: "Не вдалося видалити шаблон." }
  }
  revalidatePath("/templates")
  revalidatePath(`/templates/${template.categorySlug}`)
  revalidatePath("/admin/templates")
  return { ok: true, message: "Шаблон видалено" }
}
