"use client"

import * as React from "react"

type Theme = "light" | "dark" | "system"
type ResolvedTheme = "light" | "dark"

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: ResolvedTheme
  systemTheme?: ResolvedTheme
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined)

export function useTheme() {
  const ctx = React.useContext(ThemeContext)
  if (!ctx) {
    // fallback for outside provider (should not happen)
    return { theme: "light" as Theme, setTheme: () => {}, resolvedTheme: "light" as const, systemTheme: undefined }
  }
  return ctx
}

// ── Зовнішнє джерело теми (localStorage) ─────────────────────────────
const STORAGE_KEY = "theme"
const themeListeners = new Set<() => void>()

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system"
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === "light" || value === "dark" || value === "system" ? value : "system"
  } catch {
    return "system"
  }
}

function subscribeTheme(callback: () => void) {
  themeListeners.add(callback)
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    themeListeners.delete(callback)
    window.removeEventListener("storage", onStorage)
  }
}

function notifyThemeChange() {
  for (const listener of themeListeners) listener()
}

function writeTheme(next: Theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {}
  notifyThemeChange()
}

// ── Зовнішнє джерело системної теми (matchMedia) ─────────────────────
function readSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function subscribeSystem(callback: () => void) {
  const mql = window.matchMedia("(prefers-color-scheme: dark)")
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function applyTheme(theme: Theme, systemTheme: ResolvedTheme) {
  const resolved = theme === "system" ? systemTheme : theme
  const root = document.documentElement
  root.classList.remove("light", "dark")
  root.classList.add(resolved)
  root.style.colorScheme = resolved
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = React.useSyncExternalStore(subscribeTheme, readStoredTheme, () => "system" as Theme)
  const systemTheme = React.useSyncExternalStore(subscribeSystem, readSystemTheme, () => "light" as ResolvedTheme)

  // Застосовуємо тему до документа (побічний ефект, без setState)
  React.useEffect(() => {
    applyTheme(theme, systemTheme)
  }, [theme, systemTheme])

  const setTheme = React.useCallback((next: Theme) => {
    writeTheme(next)
  }, [])

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : theme

  const value = React.useMemo(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
      systemTheme,
    }),
    [theme, setTheme, resolvedTheme, systemTheme]
  )

  return (
    <ThemeContext.Provider value={value}>
      <ThemeHotkey />
      {children}
    </ThemeContext.Provider>
  )
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT"
}

export function ThemeHotkey() {
  const { resolvedTheme, setTheme } = useTheme()

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key.toLowerCase() !== "d") return
      if (isTypingTarget(event.target)) return
      setTheme(resolvedTheme === "dark" ? "light" : "dark")
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [resolvedTheme, setTheme])

  return null
}