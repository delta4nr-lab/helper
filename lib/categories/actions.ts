"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdminId } from "@/lib/auth"
import { orm, nowTimestamp } from "@/lib/db"

const categorySchema = z.object({
  title: z.string().trim().min(2, "Вкажіть назву категорії"),
  slug: z
    .string()
    .trim()
    .regex(
      /^[a-z0-9-]+$/,
      "Slug може містити лише латинські літери, цифри та дефіс"
    ),
  description: z.string().trim().min(2, "Вкажіть короткий опис"),
  longDescription: z.string().trim().optional(),
  sortOrder: z.coerce.number().int().min(0).max(999),
  icon: z.string().trim().optional(),
})

type CategoryResult = { ok: boolean; message: string }

export async function createCategoryAction(
  input: unknown
): Promise<CategoryResult> {
  try {
    await requireAdminId()
    const data = categorySchema.parse(input)
    await orm.Category.create({
      ...data,
      longDescription: data.longDescription || null,
      icon: data.icon || null,
      updatedAt: nowTimestamp(),
    })
    revalidatePath("/admin")
    return { ok: true, message: "Категорію створено" }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof z.ZodError
          ? (error.issues[0]?.message ?? "Перевірте дані")
          : "Не вдалося створити категорію",
    }
  }
}

export async function updateCategoryAction(
  id: string,
  input: unknown
): Promise<CategoryResult> {
  try {
    await requireAdminId()
    const data = categorySchema.parse(input)
    await orm.Category.where({ id }).update({
      ...data,
      longDescription: data.longDescription || null,
      icon: data.icon || null,
      updatedAt: nowTimestamp(),
    })
    revalidatePath("/admin")
    return { ok: true, message: "Категорію оновлено" }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof z.ZodError
          ? (error.issues[0]?.message ?? "Перевірте дані")
          : "Не вдалося оновити категорію",
    }
  }
}

export async function toggleCategoryAction(
  id: string,
  isActive: boolean
): Promise<CategoryResult> {
  try {
    await requireAdminId()
    await orm.Category.where({ id }).update({
      isActive,
      updatedAt: nowTimestamp(),
    })
    revalidatePath("/admin")
    return {
      ok: true,
      message: isActive ? "Категорію активовано" : "Категорію деактивовано",
    }
  } catch {
    return { ok: false, message: "Не вдалося змінити статус категорії" }
  }
}

export async function deleteCategoryAction(
  id: string
): Promise<CategoryResult> {
  try {
    await requireAdminId()
    const category = await orm.Category.include("templates", (t) =>
      t.count()
    ).first({ id })
    if (!category) return { ok: false, message: "Категорію не знайдено" }
    if (category.templates)
      return {
        ok: false,
        message: "Категорію з шаблонами не можна видалити. Деактивуйте її.",
      }
    await orm.Category.where({ id }).delete()
    revalidatePath("/admin")
    return { ok: true, message: "Категорію видалено" }
  } catch {
    return { ok: false, message: "Не вдалося видалити категорію" }
  }
}
