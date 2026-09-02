import { serializePageSettings, parsePageSettings, type PageSettings } from "./page"

// Збереження налаштувань сторінки для конкретного шаблону в localStorage.
// Ключ: `page:<templateId>`. Значення — JSON PageSettings.

const keyFor = (templateId: string) => `page:${templateId}`

export function readStoredPageSettings(templateId: string): PageSettings | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(keyFor(templateId))
    return parsePageSettings(raw)
  } catch {
    return null
  }
}

export function writeStoredPageSettings(templateId: string, page: PageSettings): void {
  try {
    window.localStorage.setItem(keyFor(templateId), serializePageSettings(page))
    notifyPageSettingsChanged()
  } catch {
    // localStorage недоступний — ігноруємо
  }
}

export function clearStoredPageSettings(templateId: string): void {
  try {
    window.localStorage.removeItem(keyFor(templateId))
    notifyPageSettingsChanged()
  } catch {
    // localStorage недоступний — ігноруємо
  }
}

// Підписка на зміни localStorage (для useSyncExternalStore).
// Викликається з клієнтських компонентів.
const listeners = new Set<() => void>()

export function subscribePageSettings(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function notifyPageSettingsChanged(): void {
  for (const listener of listeners) listener()
}

// Слухає подію storage (інші вкладки) та власні зміни — щоб useSyncExternalStore
// оновлювався навіть після writeStoredPageSettings.
export function initPageSettingsSync(): void {
  if (typeof window === "undefined") return
  window.addEventListener("storage", (event) => {
    if (event.key?.startsWith("page:")) notifyPageSettingsChanged()
  })
}