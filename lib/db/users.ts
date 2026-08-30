import "server-only"

import { prisma } from "@/lib/db"
import { hashPassword, requireAdmin, validateUsername, type SessionUser } from "@/lib/auth"

export async function listUsers(params: {
  q?: string
  role?: "ADMIN" | "USER"
  page?: number
  pageSize?: number
}) {
  const { q, role, page = 1, pageSize = 20 } = params
  const where: Record<string, unknown> = {}
  if (role) where.role = role
  if (q) {
    const qq = q.trim().toLowerCase()
    if (qq) {
      where.OR = [
        { username: { contains: qq, mode: "insensitive" } },
        { profile: { lastName: { contains: qq, mode: "insensitive" } } },
        { profile: { firstName: { contains: qq, mode: "insensitive" } } },
      ]
    }
  }
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where: where as never,
      include: { profile: true, _count: { select: { exports: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where: where as never }),
  ])
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export async function getUserWithExports(username: string, session: SessionUser | null) {
  // USER бачить тільки свої, ADMIN — будь-кого
  if (!session) throw new Error("Не авторизовано")
  const target = await prisma.user.findUnique({
    where: { username },
    include: { profile: true },
  })
  if (!target) return null
  if (session.role === "USER" && session.username !== username) {
    throw new Error("Недостатньо прав")
  }
  const exports = await prisma.exportedFile.findMany({
    where: { userId: target.id },
    include: { template: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
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

  const exists = await prisma.user.findUnique({ where: { username } })
  if (exists) throw new Error("Користувач з таким логіном вже існує")

  const password = await hashPassword(data.password)

  return prisma.user.create({
    data: {
      username,
      password,
      role: data.role ?? "USER",
      profile: {
        create: {
          lastName: data.profile?.lastName?.trim() || null,
          firstName: data.profile?.firstName?.trim() || null,
          middleName: data.profile?.middleName?.trim() || null,
          rank: data.profile?.rank?.trim() || null,
        },
      },
    },
    include: { profile: true },
  })
}

export async function deactivateUser(username: string, session: SessionUser) {
  requireAdmin(session)
  if (session.username === username) throw new Error("Не можна деактивувати себе")
  return prisma.user.update({
    where: { username },
    data: { isActive: false },
  })
}
