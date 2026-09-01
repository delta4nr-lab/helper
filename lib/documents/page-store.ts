// Клієнтське збереження налаштувань сторінки в localStorage.
// Ключ прив'язаний до конкретного шаблону — налаштування зберігаються
// для документа цього користувача/браузера і не впливають на інших.
import { parsePageSettings, serializePageSettings, type PageSettings } from "./page"

const PREFIX = "page-settings:"
const listeners = new Set<() => void>()

function storageKey(templateId: string): string {
  return PREFIX + templateId
}

export function readStoredPageSettings(templateId: string): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(storageKey(templateId))
}

export function writeStoredPageSettings(templateId: string, settings: PageSettings) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(storageKey(templateId), serializePageSettings(settings))
  } catch {}
  for (const listener of listeners) listener()
}

export function clearStoredPageSettings(templateId: string) {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(storageKey(templateId))
  for (const listener of listeners) listener()
}

export function subscribePageSettings(callback: () => void) {
  listeners.add(callback)
  const onStorage = (event: StorageEvent) => {
    if (event.key && event.key.startsWith(PREFIX)) callback()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(callback)
    window.removeEventListener("storage", onStorage)
  }
}

export function getStoredPageSettings(templateId: string): PageSettings | null {
  return parsePageSettings(readStoredPageSettings(templateId))
}