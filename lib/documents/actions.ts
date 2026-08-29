"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { validateDocumentData } from "@/lib/documents/registry"
import { raportVidpustkaTitle } from "@/lib/documents/schemas/raport-vidpustka"
import { raportVidryadzhennyaTitle } from "@/lib/documents/schemas/raport-vidryadzhennya"

type ActionResult = { ok: boolean; message: string; documentId?: string }

type TemplateActionResult = { ok: boolean; message: string; templateId?: string }

async function getSessionUser() {
  const session = await (auth as unknown as () => Promise<{ user?: { id?: string } } | null>)()
  return session?.user?.id ?? null
}

export async function createTemplateAction(data: {
  id: string
  title: string
  categorySlug: string
  description: string
  headerTemplate: string
  bodyTemplate: string
  footerTemplate: string
}): Promise<TemplateActionResult> {
  const session = await (auth as unknown as () => Promise<{ user?: { id?: string; role?: string } } | null>)()
  if (!session?.user?.id || session.user.role !== "ADMIN") return { ok: false, message: "Недостатньо прав" }

  const id = data.id.trim().toLowerCase()
  if (!/^[a-z0-9-]+$/.test(id)) return { ok: false, message: "ID може містити лише латинські літери, цифри та дефіс" }
  if (!data.title.trim()) return { ok: false, message: "Вкажіть назву шаблону" }

  const category = await prisma.category.findUnique({ where: { slug: data.categorySlug } })
  if (!category) return { ok: false, message: "Категорію не знайдено" }

  const templateContent = `${data.headerTemplate}\n${data.bodyTemplate}\n${data.footerTemplate}`
  const keys = [...new Set([
    ...[...templateContent.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]),
    ...[...templateContent.matchAll(/data-field-key=["'](\w+)["']/g)].map((match) => match[1]),
  ])]
  try {
    await prisma.template.create({
      data: {
        id,
        categoryId: category.id,
        categorySlug: category.slug,
        title: data.title.trim(),
        fields: keys.length,
        description: data.description.trim(),
        tags: [],
        headerTemplate: data.headerTemplate,
        bodyTemplate: data.bodyTemplate,
        footerTemplate: data.footerTemplate,
        createdById: session.user.id,
        fieldsConfig: {
          create: keys.map((key, sortOrder) => ({ key, label: key, type: "text", sortOrder })),
        },
      },
    })
  } catch {
    return { ok: false, message: "Не вдалося створити шаблон. Перевірте ID та спробуйте ще раз." }
  }

  revalidatePath(`/templates/${category.slug}`)
  revalidatePath("/templates")
  return { ok: true, message: "Шаблон створено", templateId: id }
}

export async function createDocumentAction(data: {
  templateId: string
  categorySlug: string
  data: Record<string, unknown>
  personnelId?: string
}): Promise<ActionResult> {
  const userId = await getSessionUser()
  if (!userId) return { ok: false, message: "Не авторизовано. Увійдіть." }

  const { templateId, categorySlug, data: rawData, personnelId } = data

  if (!templateId || !categorySlug) return { ok: false, message: "Невірний шаблон" }

  const template = await prisma.template.findUnique({ where: { id: templateId } })
  if (!template || !template.isActive) return { ok: false, message: "Шаблон не знайдено або деактивовано" }

  // Валідація через реєстр Zod
  const validation = validateDocumentData(templateId, rawData)
  if (!validation.success) {
    const first = validation.error.issues[0]
    return { ok: false, message: first?.message || "Помилка валідації" }
  }
  const validated = validation.data as Record<string, unknown>

  // Персоналія: якщо personnelId вказано — перевірити існування
  let personnelLabel: string | undefined
  if (validated.personnelId && typeof validated.personnelId === "string" && validated.personnelId) {
    const p = await prisma.personnel.findUnique({ where: { id: validated.personnelId as string } })
    if (!p) return { ok: false, message: "Обраного військовослужбовця не знайдено" }
    personnelLabel = [p.lastName, p.firstName, p.middleName].filter(Boolean).join(" ")
    // денормалізуємо ПІБ для рендеру якщо потрібно
  }

  // Заголовок — для відрядження (єдиний рапорт) окреме форматування
  let title = template.title
  if (templateId === "raport-vidryadzhennya") {
    title = raportVidryadzhennyaTitle(validated as never, personnelLabel)
  } else if (templateId === "raport-vidpustka") {
    title = raportVidpustkaTitle(validated as never, personnelLabel)
  } else {
    title = `${template.title} — ${new Date().toLocaleDateString("uk-UA")}`
  }

  // Категорія
  const category = await prisma.category.findUnique({ where: { slug: categorySlug } })

  const doc = await prisma.document.create({
    data: {
      templateId,
      categoryId: category?.id ?? null,
      categorySlug,
      title,
      data: validated as never,
      personnelId: (validated.personnelId as string) || personnelId || null,
      authorId: userId,
      status: "чернетка",
    },
  })

  revalidatePath(`/profile`)
  revalidatePath(`/templates/${categorySlug}/${templateId}`)
  revalidatePath(`/templates/${categorySlug}`)

  return { ok: true, message: "Документ створено", documentId: doc.id }
}

export async function updateDocumentAction(data: {
  documentId: string
  data: Record<string, unknown>
}): Promise<ActionResult> {
  const userId = await getSessionUser()
  if (!userId) return { ok: false, message: "Не авторизовано. Увійдіть." }

  const { documentId, data: rawData } = data

  const existing = await prisma.document.findUnique({ where: { id: documentId }, include: { template: true } })
  if (!existing) return { ok: false, message: "Документ не знайдено" }

  // Перевірка прав: автор або ADMIN
  const session = await (auth as unknown as () => Promise<{ user?: { id?: string; role?: string } } | null>)()
  const role = (session?.user as unknown as { role?: string })?.role
  if (existing.authorId !== userId && role !== "ADMIN") {
    return { ok: false, message: "Недостатньо прав для редагування" }
  }

  const validation = validateDocumentData(existing.templateId, rawData)
  if (!validation.success) {
    const first = validation.error.issues[0]
    return { ok: false, message: first?.message || "Помилка валідації" }
  }
  const validated = validation.data as Record<string, unknown>

  let personnelLabel: string | undefined
  if (validated.personnelId && typeof validated.personnelId === "string" && validated.personnelId) {
    const p = await prisma.personnel.findUnique({ where: { id: validated.personnelId as string } })
    if (!p) return { ok: false, message: "Обраного військовослужбовця не знайдено" }
    personnelLabel = [p.lastName, p.firstName, p.middleName].filter(Boolean).join(" ")
  }

  let title = existing.template.title
  if (existing.templateId === "raport-vidpustka") {
    title = raportVidpustkaTitle(validated as never, personnelLabel)
  } else if (existing.templateId === "raport-vidryadzhennya") {
    title = raportVidryadzhennyaTitle(validated as never, personnelLabel)
  } else {
    title = `${existing.template.title} — ${new Date().toLocaleDateString("uk-UA")}`
  }

  await prisma.document.update({
    where: { id: documentId },
    data: {
      title,
      data: validated as never,
      personnelId: (validated.personnelId as string) || null,
    },
  })

  revalidatePath(`/profile`)
  revalidatePath(`/templates/${existing.categorySlug}/${existing.templateId}`)
  revalidatePath(`/documents/${documentId}`)
  revalidatePath(`/documents/${documentId}/edit`)

  return { ok: true, message: "Документ оновлено", documentId }
}
