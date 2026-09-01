import "server-only"

import { orm, nowTimestamp } from "@/lib/db"
import { or } from "@prisma/orm-postgres/orm-client"
import { hashPassword, requireAdmin, validateUsername, type SessionUser } from "@/lib/auth"

export async function listUsers(params: {
  q?: string
  role?: "ADMIN" | "USER"
  page?: number
  pageSize?: number
}) {
  const { q, role, page = 1, pageSize = 20 } = params
  let collection = orm.User
  if (role) collection = collection.where({ role })
  if (q) {
    const qq = q.trim().toLowerCase()
    if (qq) {
      collection = collection.where((u) =>
        or(
          u.username.ilike(`%${qq}%`),
          u.profile.some((p) => p.lastName.ilike(`%${qq}%`)),
          u.profile.some((p) => p.firstName.ilike(`%${qq}%`))
        )
      )
    }
  }
  const [items, total] = await Promise.all([
    collection
      .include("profile", (p) => p)
      .include("exportedFiles", (ef) => ef.count())
      .orderBy((u) => u.createdAt.desc())
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .all(),
    collection.aggregate((agg) => ({ count: agg.count() })),
  ])
  return { items, total: total.count, page, pageSize, totalPages: Math.ceil(total.count / pageSize) }
}

export async function getUserWithExports(username: string, session: SessionUser | null) {
  // USER бачить тільки свої, ADMIN — будь-кого
  if (!session) throw new Error("Не авторизовано")
  const target = await orm.User.where({ username }).include("profile", (p) => p).first()
  if (!target) return null
  if (session.role === "USER" && session.username !== username) {
    throw new Error("Недостатньо прав")
  }
  const exports = await orm.ExportedFile.where({ userId: target.id })
    .include("template", (t) => t)
    .orderBy((f) => f.createdAt.desc())
    .limit(50)
    .all()
  return { user: target, exports }
}

export async function createUser(
  data: {
    username: string
    password: string // plain, буде захешовано
    role?: "ADMIN" | "USER"
    profile?: { lastName?: string; firstName?: string; middleName?: string; rank?: string }
  },
  session: SessionUser
) {
  requireAdmin(session)

  const username = data.username.trim().toLowerCase()
  const err = validateUsername(username)
  if (err) throw new Error(err)
  if (!data.password || data.password.length < 8) throw new Error("Пароль мінімум 8 символів")
  if (data.role && !["ADMIN", "USER"].includes(data.role)) throw new Error("Невірна роль")

  const exists = await orm.User.first({ username })
  if (exists) throw new Error("Користувач з таким логіном вже існує")

  const password = await hashPassword(data.password)

  return orm.User.create({
    username,
    password,
    role: data.role ?? "USER",
    updatedAt: nowTimestamp(),
    profile: (profile) =>
      profile.create({
        lastName: data.profile?.lastName?.trim() || null,
        firstName: data.profile?.firstName?.trim() || null,
        middleName: data.profile?.middleName?.trim() || null,
        rank: data.profile?.rank?.trim() || null,
        updatedAt: nowTimestamp(),
      }),
  })
}

export async function deactivateUser(username: string, session: SessionUser) {
  requireAdmin(session)
  if (session.username === username) throw new Error("Не можна деактивувати себе")
  return orm.User.where({ username }).update({ isActive: false, updatedAt: nowTimestamp() })
}