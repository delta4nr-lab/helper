"use server"

import { unlink } from "node:fs/promises"
import path from "node:path"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getAdminId } from "@/lib/auth"
import { orm, nowTimestamp } from "@/lib/db"
import { SIGNATURES_ROOT } from "@/lib/storage/paths"

const personnelSchema = z.object({
  lastName: z.string().trim().min(1, "Вкажіть прізвище"),
  firstName: z.string().trim().min(1, "Вкажіть ім'я"),
  middleName: z.string().trim().optional(),
  rank: z.string().trim().min(1, "Вкажіть звання"),
  position: z.string().trim().min(1, "Вкажіть посаду"),
  status: z.string().trim().default("в строю"),
  signaturePath: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^\/signature\/[A-Za-z0-9._-]+$/.test(value),
      "Некоректний шлях підпису"
    )
    .optional(),
})

// Видаляє файл підпису з приватного storage/signature (за шляхом /signature/...).
// Дозволено лише файли безпосередньо в цій теці — без виходу назовні.
async function removeSignatureFile(signaturePath?: string | null) {
  if (!signaturePath || !signaturePath.startsWith("/signature/")) return
  const fileName = path.basename(signaturePath)
  if (!fileName || fileName === "." || fileName === "..") return
  const target = path.resolve(SIGNATURES_ROOT, fileName)
  if (!target.startsWith(SIGNATURES_ROOT + path.sep)) return
  await unlink(target).catch(() => {})
}

export async function createPersonnelAction(
  input: unknown
): Promise<{ ok: boolean; message: string }> {
  const adminId = await getAdminId()
  if (!adminId) return { ok: false, message: "Недостатньо прав" }
  try {
    const data = personnelSchema.parse(input)
    await orm.Personnel.create({
      lastName: data.lastName,
      firstName: data.firstName,
      middleName: data.middleName || null,
      rank: data.rank,
      position: data.position,
      status: data.status,
      signaturePath: data.signaturePath || null,
      updatedAt: nowTimestamp(),
    })
    revalidatePath("/admin/personnel")
    return { ok: true, message: "Людину додано до штату" }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof z.ZodError
          ? "Перевірте дані форми"
          : "Не вдалося зберегти. Спробуйте ще раз.",
    }
  }
}

export async function updatePersonnelAction(
  id: string,
  input: unknown
): Promise<{ ok: boolean; message: string }> {
  const adminId = await getAdminId()
  if (!adminId) return { ok: false, message: "Недостатньо прав" }
  try {
    const data = personnelSchema.parse(input)
    const existing = await orm.Personnel.select("signaturePath").first({ id })
    await orm.Personnel.where({ id }).update({
      lastName: data.lastName,
      firstName: data.firstName,
      middleName: data.middleName || null,
      rank: data.rank,
      position: data.position,
      status: data.status,
      signaturePath: data.signaturePath || null,
      updatedAt: nowTimestamp(),
    })
    // Старий підпис замінено новим або видалено — прибираємо файл
    if (
      existing?.signaturePath &&
      existing.signaturePath !== data.signaturePath
    ) {
      await removeSignatureFile(existing.signaturePath)
    }
    revalidatePath("/admin/personnel")
    return { ok: true, message: "Дані оновлено" }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof z.ZodError
          ? "Перевірте дані форми"
          : "Не вдалося зберегти. Спробуйте ще раз.",
    }
  }
}

export async function deletePersonnelAction(
  id: string
): Promise<{ ok: boolean; message: string }> {
  const adminId = await getAdminId()
  if (!adminId) return { ok: false, message: "Недостатньо прав" }
  try {
    const existing = await orm.Personnel.select("signaturePath").first({ id })
    await orm.Personnel.where({ id }).delete()
    await removeSignatureFile(existing?.signaturePath)
    revalidatePath("/admin/personnel")
    return { ok: true, message: "Видалено зі штату" }
  } catch {
    return {
      ok: false,
      message:
        "Не вдалося видалити. Можливо, людина використовується в документах.",
    }
  }
}
