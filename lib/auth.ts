import "server-only"

import { auth } from "@/auth"

export type SessionUser = {
  id: string
  username: string
  role: "ADMIN" | "USER"
  isActive: boolean
}

// --- Канонічні server helpers (auth() з @/auth) ---

/** Типізована сесія або null, без кастів у сторінках. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth()
  const u = session?.user as unknown as SessionUser | undefined
  if (!u?.id) return null
  return {
    id: u.id,
    username: u.username,
    role: u.role,
    isActive: u.isActive,
  }
}

/** ID адміністратора або null. Перевіряє роль і isActive на сервері. */
export async function getAdminId(): Promise<string | null> {
  const user = await getSessionUser()
  if (!user || !user.isActive || user.role !== "ADMIN") return null
  return user.id
}

/** Як getAdminId, але кидає помилку (для дій, що очікують try/catch). */
export async function requireAdminId(): Promise<string> {
  const id = await getAdminId()
  if (!id) throw new Error("Недостатньо прав")
  return id
}
