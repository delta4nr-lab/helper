"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"

const categorySchema = z.object({
  title: z.string().trim().min(2, "Вкажіть назву категорії"),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/, "Slug може містити лише латинські літери, цифри та дефіс"),
  description: z.string().trim().min(2, "Вкажіть короткий опис"),
  longDescription: z.string().trim().optional(),
  sortOrder: z.coerce.number().int().min(0).max(999),
  icon: z.string().trim().optional(),
})

type CategoryResult = { ok: boolean; message: string }

async function requireAdmin() {
  const session = await (auth as unknown as () => Promise<{ user?: { id?: string; role?: string } } | null>)()
  if (!session?.user?.id || session.user.role !== "ADMIN") throw new Error("Недостатньо прав")
  return session.user.id
}

export async function createCategoryAction(input: unknown): Promise<CategoryResult> {
  try {
    await requireAdmin()
    const data = categorySchema.parse(input)
    await prisma.category.create({ data: { ...data, longDescription: data.longDescription || null, icon: data.icon || null } })
    revalidatePath("/admin")
    revalidatePath("/templates")
    return { ok: true, message: "Категорію створено" }
  } catch (error) {
    return { ok: false, message: error instanceof z.ZodError ? error.issues[0]?.message ?? "Перевірте дані" : "Не вдалося створити категорію" }
  }
}

export async function updateCategoryAction(id: string, input: unknown): Promise<CategoryResult> {
  try {
    await requireAdmin()
    const data = categorySchema.parse(input)
    await prisma.category.update({ where: { id }, data: { ...data, longDescription: data.longDescription || null, icon: data.icon || null } })
    revalidatePath("/admin")
    revalidatePath("/templates")
    revalidatePath(`/templates/${data.slug}`)
    return { ok: true, message: "Категорію оновлено" }
  } catch (error) {
    return { ok: false, message: error instanceof z.ZodError ? error.issues[0]?.message ?? "Перевірте дані" : "Не вдалося оновити категорію" }
  }
}

export async function toggleCategoryAction(id: string, isActive: boolean): Promise<CategoryResult> {
  try {
    await requireAdmin()
    await prisma.category.update({ where: { id }, data: { isActive } })
    revalidatePath("/admin")
    revalidatePath("/templates")
    return { ok: true, message: isActive ? "Категорію активовано" : "Категорію деактивовано" }
  } catch {
    return { ok: false, message: "Не вдалося змінити статус категорії" }
  }
}

export async function deleteCategoryAction(id: string): Promise<CategoryResult> {
  try {
    await requireAdmin()
    const category = await prisma.category.findUnique({ where: { id }, include: { _count: { select: { templates: true, documents: true } } } })
    if (!category) return { ok: false, message: "Категорію не знайдено" }
    if (category._count.templates || category._count.documents) return { ok: false, message: "Категорію з шаблонами або документами не можна видалити. Деактивуйте її." }
    await prisma.category.delete({ where: { id } })
    revalidatePath("/admin")
    revalidatePath("/templates")
    return { ok: true, message: "Категорію видалено" }
  } catch {
    return { ok: false, message: "Не вдалося видалити категорію" }
  }
}
