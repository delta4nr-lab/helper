// Спільні правила валідації для акаунтів. Без "server-only" — правила однакові
// на клієнті й сервері.

export const SALT_ROUNDS = 10
export const PASSWORD_MIN_LENGTH = 8
export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 32

export function validateUsername(username: string): string | null {
  const u = username.trim()
  if (u.length < USERNAME_MIN_LENGTH || u.length > USERNAME_MAX_LENGTH) {
    return `Логін має бути ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} символів`
  }
  if (!/^[a-z0-9_-]+$/.test(u)) return "Логін: тільки латиниця, цифри, _ та -"
  return null
}
