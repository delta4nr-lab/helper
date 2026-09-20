// Форматування імен/ініціалів. Без "server-only" — використовується і на клієнті.

export type PersonNameParts = {
  lastName?: string | null
  firstName?: string | null
  middleName?: string | null
}

/** Повне ім'я: «Прізвище Ім'я По батькові» (пропускає порожні частини). */
export function getFullName(parts: PersonNameParts): string {
  return [parts.lastName, parts.firstName, parts.middleName]
    .filter(Boolean)
    .join(" ")
}

/** Скорочене ім'я: «Прізвище Ім'я» (без по батькові). */
export function getShortName(parts: PersonNameParts): string {
  return [parts.lastName, parts.firstName].filter(Boolean).join(" ")
}

/** Перша літера логіну для аватара (без файлу). */
export function getInitials(username: string): string {
  return username.trim().charAt(0).toUpperCase() || "?"
}
