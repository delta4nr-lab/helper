"use server"

import bcrypt from "bcrypt"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getAdminId } from "@/lib/auth"
import { orm, nowTimestamp } from "@/lib/db"
import { SALT_ROUNDS } from "@/lib/validation"

const userSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_-]+$/),
  password: z.string().min(8),
  role: z.enum(["USER", "ADMIN"]),
  lastName: z.string().trim().optional(),
  firstName: z.string().trim().optional(),
  middleName: z.string().trim().optional(),
  rank: z.string().trim().optional(),
})

export async function createUserAction(
  input: unknown
): Promise<{ ok: boolean; message: string }> {
  const adminId = await getAdminId()
  if (!adminId) return { ok: false, message: "Недостатньо прав" }

  try {
    const data = userSchema.parse(input)
    const password = await bcrypt.hash(data.password, SALT_ROUNDS)
    await orm.User.create({
      username: data.username,
      password,
      role: data.role,
      updatedAt: nowTimestamp(),
      profile: (profile) =>
        profile.create({
          lastName: data.lastName || null,
          firstName: data.firstName || null,
          middleName: data.middleName || null,
          rank: data.rank || null,
          updatedAt: nowTimestamp(),
        }),
    })
    revalidatePath("/admin")
    return { ok: true, message: "Користувача створено" }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof z.ZodError
          ? "Перевірте дані форми"
          : "Логін вже зайнятий або користувача не вдалося створити",
    }
  }
}
