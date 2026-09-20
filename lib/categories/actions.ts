"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAdminId } from "@/lib/auth"
import { CATEGORY_ICON_KEYS } from "@/lib/categories/icons"
import { orm, nowTimestamp } from "@/lib/db"
import { slugify } from "@/lib/slugify"

// slug не приймаємо від клієнта: при створенні генеруємо з назви, при
// редагуванні лишаємо наявний (щоб не ламати URL категорій).
const categoryMetaShape = {
  title: z.string().trim().min(2, "Вкажіть назву категорії"),
  description: z.string().trim().min(2, "Вкажіть короткий опис"),
  longDescription: z.string().trim().optional(),
  icon: z.enum(CATEGORY_ICON_KEYS).nullish(),
}

const createCategorySchema = z.object(categoryMetaShape)
const updateCategorySchema = z.object(categoryMetaShape)

type CategoryResult = { ok: boolean; message: string; category?: CategoryRow }

export type CategoryRow = {
  id: string
  title: string
  slug: string
  description: string
  longDescription: string | null
  sortOrder: number
  icon: string | null
  isActive: boolean
  templates: number
}

const MAX_SLUG_ATTEMPTS = 20

function isUniqueViolation(error: unknown): boolean {
  const text = String(error)
  return text.includes("Category_slug_key") || /unique/i.test(text)
}

function slugCandidate(base: string, attempt: number): string {
  return attempt === 0 ? base : `${base}-${attempt + 1}`
}

export async function createCategoryAction(
  input: unknown
): Promise<CategoryResult> {
  try {
    await requireAdminId()
    const data = createCategorySchema.parse(input)
    const base = slugify(data.title) || "category"

    const last = await orm.Category.orderBy((c) => c.sortOrder.desc())
      .select("sortOrder")
      .first()
    const sortOrder = (last?.sortOrder ?? -1) + 1

    // Унікальність slug із захистом від race: БД має unique(Category_slug_key),
    // тож на конфлікт пробуємо наступний суфікс.
    for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
      try {
        const created = await orm.Category.create({
          title: data.title,
          slug: slugCandidate(base, attempt),
          description: data.description,
          longDescription: data.longDescription || null,
          icon: data.icon ?? null,
          sortOrder,
          updatedAt: nowTimestamp(),
        })
        revalidatePath("/admin/categories")
        revalidatePath("/templates")
        return {
          ok: true,
          message: "Категорію створено",
          category: {
            id: created.id,
            title: created.title,
            slug: created.slug,
            description: created.description,
            longDescription: created.longDescription ?? null,
            sortOrder: created.sortOrder,
            icon: created.icon ?? null,
            isActive: created.isActive,
            templates: 0,
          },
        }
      } catch (error) {
        if (isUniqueViolation(error)) continue
        throw error
      }
    }
    return { ok: false, message: "Не вдалося підібрати унікальний slug" }
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
    const data = updateCategorySchema.parse(input)
    await orm.Category.where({ id }).update({
      title: data.title,
      description: data.description,
      longDescription: data.longDescription || null,
      icon: data.icon ?? null,
      updatedAt: nowTimestamp(),
    })
    revalidatePath("/admin/categories")
    revalidatePath("/templates")
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

// Переміщення категорії вгору/вниз у списку. Межі — no-op без помилки.
// sortOrder перезаписуємо послідовно (index), що заодно прибирає дублікати.
export async function moveCategoryAction(
  id: string,
  direction: "up" | "down"
): Promise<CategoryResult> {
  try {
    await requireAdminId()
    if (direction !== "up" && direction !== "down") {
      return { ok: false, message: "Невірний напрямок" }
    }
    const ordered = await orm.Category.orderBy([
      (c) => c.sortOrder.asc(),
      (c) => c.title.asc(),
    ])
      .select("id")
      .all()
    const index = ordered.findIndex((c) => c.id === id)
    if (index === -1) return { ok: false, message: "Категорію не знайдено" }

    const target = direction === "up" ? index - 1 : index + 1
    if (target < 0 || target >= ordered.length) {
      return { ok: true, message: "Порядок не змінився" }
    }

    const next = ordered.slice()
    ;[next[index], next[target]] = [next[target], next[index]]
    await Promise.all(
      next.map((item, position) =>
        orm.Category.where({ id: item.id }).update({ sortOrder: position })
      )
    )
    revalidatePath("/admin/categories")
    revalidatePath("/templates")
    return { ok: true, message: "Порядок оновлено" }
  } catch {
    return { ok: false, message: "Не вдалося змінити порядок" }
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
    revalidatePath("/admin/categories")
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
    revalidatePath("/admin/categories")
    revalidatePath("/templates")
    return { ok: true, message: "Категорію видалено" }
  } catch {
    return { ok: false, message: "Не вдалося видалити категорію" }
  }
}
