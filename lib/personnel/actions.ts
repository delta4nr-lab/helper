"use server"

import { unlink } from "node:fs/promises"
import path from "node:path"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/auth"
import { orm, nowTimestamp } from "@/lib/db"

const personnelSchema = z.object({
  lastName: z.string().trim().min(1, "Вкажіть прізвище"),
  firstName: z.string().trim().min(1, "Вкажіть ім'я"),
  middleName: z.string().trim().optional(),
  rank: z.string().trim().min(1, "Вкажіть звання"),
  position: z.string().trim().min(1, "Вкажіть посаду"),
  status: z.string().trim().default("в строю"),
  signaturePath: z.string().trim().optional(),
})

async function requireAdmin() {
  const session = await (auth as unknown as () => Promise<{ user?: { id?: string; role?: string } } | null>)()
  return session?.user?.id && session.user.role === "ADMIN" ? session.user.id : null
}

// Видаляє файл підпису з public/signature (за шляхом /signature/...)
async function removeSignatureFile(signaturePath?: string | null) {
  if (!signaturePath || !signaturePath.startsWith("/signature/")) return
  const fileName = signaturePath.replace("/signature/", "")
  await unlink(path.join(process.cwd(), "public", "signature", fileName)).catch(() => {})
}

export async function createPersonnelAction(input: unknown): Promise<{ ok: boolean; message: string }> {
  const adminId = await requireAdmin()
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
    return { ok: false, message: error instanceof z.ZodError ? "Перевірте дані форми" : "Не вдалося зберегти. Спробуйте ще раз." }
  }
}

export async function updatePersonnelAction(id: string, input: unknown): Promise<{ ok: boolean; message: string }> {
  const adminId = await requireAdmin()
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
    if (existing?.signaturePath && existing.signaturePath !== data.signaturePath) {
      await removeSignatureFile(existing.signaturePath)
    }
    revalidatePath("/admin/personnel")
    return { ok: true, message: "Дані оновлено" }
  } catch (error) {
    return { ok: false, message: error instanceof z.ZodError ? "Перевірте дані форми" : "Не вдалося зберегти. Спробуйте ще раз." }
  }
}

export async function deletePersonnelAction(id: string): Promise<{ ok: boolean; message: string }> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, message: "Недостатньо прав" }
  try {
    const existing = await orm.Personnel.select("signaturePath").first({ id })
    await orm.Personnel.where({ id }).delete()
    await removeSignatureFile(existing?.signaturePath)
    revalidatePath("/admin/personnel")
    return { ok: true, message: "Видалено зі штату" }
  } catch {
    return { ok: false, message: "Не вдалося видалити. Можливо, людина використовується в документах." }
  }
}