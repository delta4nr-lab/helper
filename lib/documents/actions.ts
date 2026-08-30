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
}

async function requireAdmin() {
  const session = await (auth as unknown as () => Promise<{ user?: { id?: string; role?: string } } | null>)()
  return session?.user?.id && session.user.role === "ADMIN" ? session.user.id : null
}

function fieldKeys(data: TemplateMutation) {
  const content = `${data.headerTemplate}\n${data.bodyTemplate}\n${data.footerTemplate}`
  return [...new Set([
    ...[...content.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]),
    ...[...content.matchAll(/data-field-key=["'](\w+)["']/g)].map((match) => match[1]),
  ])]
}

export async function createTemplateAction(data: {
  title: string
  categorySlug: string
  description: string
  headerTemplate: string
  bodyTemplate: string
  footerTemplate: string
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

  const keys = fieldKeys(data)

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
        headerTemplate: data.headerTemplate,
        bodyTemplate: data.bodyTemplate,
        footerTemplate: data.footerTemplate,
        createdById: userId,
        fieldsConfig: { create: keys.map((key, sortOrder) => ({ key, label: key, type: "text", sortOrder })) },
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
  const keys = fieldKeys(data)

  try {
    await prisma.$transaction(async (tx) => {
      await tx.template.update({
        where: { id: templateId },
        data: { categoryId: category.id, categorySlug: category.slug, title, description: data.description.trim(), headerTemplate: data.headerTemplate, bodyTemplate: data.bodyTemplate, footerTemplate: data.footerTemplate, fields: keys.length },
      })
      await tx.templateField.deleteMany({ where: { templateId } })
      if (keys.length) await tx.templateField.createMany({ data: keys.map((key, sortOrder) => ({ templateId, key, label: key, type: "text", sortOrder })) })
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
