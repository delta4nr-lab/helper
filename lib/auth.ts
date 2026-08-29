import "server-only"

import bcrypt from "bcrypt"
import { prisma } from "@/lib/db"

// Простий session через cookies/JWT буде додано пізніше — зараз базові хелпери
// Використовується тільки на сервері (AGENTS: Security)

const SALT_ROUNDS = 10

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export type SessionUser = {
  id: string
  username: string
  role: "ADMIN" | "USER"
  isActive: boolean
}

// Заглушка — наступний крок: отримати сесію з cookies (iron-session / jose)
// Поки передаємо user явно в Server Actions
export function requireAdmin(session: SessionUser | null) {
  if (!session) throw new Error("Не авторизовано")
  if (!session.isActive) throw new Error("Акаунт деактивовано")
  if (session.role !== "ADMIN") throw new Error("Недостатньо прав: тільки для адміністратора")
}

export function requireAuth(session: SessionUser | null) {
  if (!session) throw new Error("Не авторизовано")
  if (!session.isActive) throw new Error("Акаунт деактивовано")
}

// Хелпер для аватара — перша літера логіну (вимога: без файлу)
export function avatarFallback(username: string): string {
  return username.trim().charAt(0).toUpperCase() || "?"
}

// Валідація імені користувача (юзернейм без email)
export function validateUsername(username: string): string | null {
  const u = username.trim()
  if (u.length < 3 || u.length > 20) return "Логін має бути 3–20 символів"
  if (!/^[a-z0-9_]+$/.test(u)) return "Логін: тільки латиниця, цифри та _"
  return null
}

export async function getUserByUsername(username: string) {
  return prisma.user.findUnique({
    where: { username: username.trim().toLowerCase() },
    include: { profile: true },
  })
}
