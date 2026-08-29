"use server"

import bcrypt from "bcrypt"
import { revalidatePath } from "next/cache"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { validateUsername } from "@/lib/auth"

type ActionResult = { ok: boolean; message: string; field?: string }

type SessionLike = { user?: { id?: string; name?: string | null } } | null

function getSessionUserId(session: SessionLike): string | null {
  if (!session?.user) return null
  const u = session.user as unknown as { id?: string }
  return u.id ?? null
}

async function getSession() {
  // обхід типів NextAuth (auth як middleware + helper)
  const s = await (auth as unknown as () => Promise<SessionLike>)()
  return s
}

export async function updateAccountAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const userId = getSessionUserId(session)
  if (!userId) return { ok: false, message: "Не авторизовано" }

  const rawUsername = String(formData.get("username") ?? "").trim().toLowerCase()
  const rawNewPassword = String(formData.get("newPassword") ?? "")
  const rawConfirm = String(formData.get("confirmPassword") ?? "")

  // Валідація логіну
  const err = validateUsername(rawUsername)
  if (err) return { ok: false, message: err, field: "username" }

  const current = await prisma.user.findUnique({ where: { id: userId } })
  if (!current) return { ok: false, message: "Користувача не знайдено" }

  // Перевірка унікальності якщо логін змінився
  if (rawUsername !== current.username) {
    const exists = await prisma.user.findUnique({ where: { username: rawUsername } })
    if (exists) return { ok: false, message: "Логін вже зайнятий", field: "username" }
  }

  const data: Record<string, unknown> = {}
  if (rawUsername !== current.username) data.username = rawUsername

  // Пароль — необов'язковий
  if (rawNewPassword || rawConfirm) {
    if (rawNewPassword.length < 8) return { ok: false, message: "Новий пароль мінімум 8 символів", field: "newPassword" }
    if (rawNewPassword !== rawConfirm) return { ok: false, message: "Паролі не збігаються", field: "confirmPassword" }
    const hash = await bcrypt.hash(rawNewPassword, 10)
    data.password = hash
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, message: "Немає змін для збереження" }
  }

  await prisma.user.update({ where: { id: userId }, data: data as never })

  revalidatePath("/profile")
  // JWT містить username — після зміни логіну треба перелогінитись
  if (data.username) {
    return { ok: true, message: "Логін змінено. Увійдіть знову, щоб оновити сесію." }
  }
  if (data.password) {
    return { ok: true, message: "Пароль успішно оновлено" }
  }
  return { ok: true, message: "Зміни збережено" }
}

export async function updateProfileDetailsAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const session = await getSession()
  const userId = getSessionUserId(session)
  if (!userId) return { ok: false, message: "Не авторизовано" }

  const lastName = String(formData.get("lastName") ?? "").trim() || null
  const firstName = String(formData.get("firstName") ?? "").trim() || null
  const middleName = String(formData.get("middleName") ?? "").trim() || null
  const rank = String(formData.get("rank") ?? "").trim() || null

  // ПІБ та звання — необов'язкові, але обмежимо довжину
  for (const [field, val] of [
    ["Прізвище", lastName],
    ["Ім'я", firstName],
    ["По батькові", middleName],
    ["Звання", rank],
  ] as const) {
    if (val && val.length > 64) return { ok: false, message: `${field} занадто довге (макс 64)`, field: field }
  }

  await prisma.profile.upsert({
    where: { userId },
    create: { userId, lastName, firstName, middleName, rank },
    update: { lastName, firstName, middleName, rank },
  })

  revalidatePath("/profile")
  return { ok: true, message: "Дані профілю збережено" }
}
