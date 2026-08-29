"use client"

import * as React from "react"

type Theme = "light" | "dark" | "system"

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: "light" | "dark"
  systemTheme?: "light" | "dark"
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

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function applyTheme(theme: Theme, systemTheme: "light" | "dark") {
  const resolved = theme === "system" ? systemTheme : theme
  const root = document.documentElement
  root.classList.remove("light", "dark")
  root.classList.add(resolved)
  root.style.colorScheme = resolved
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("light")
  const [systemTheme, setSystemTheme] = React.useState<"light" | "dark">("light")
  const [mounted, setMounted] = React.useState(false)

  // Initialize from localStorage / system
  React.useEffect(() => {
    const stored = (localStorage.getItem("theme") as Theme | null) ?? "system"
    setThemeState(stored)
    const sys = getSystemTheme()
    setSystemTheme(sys)
    setMounted(true)
  }, [])

  // Listen to system changes
  React.useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = (e: MediaQueryListEvent) => {
      const sys = e.matches ? "dark" : "light"
      setSystemTheme(sys)
    }
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [])

  // Apply theme to document
  React.useEffect(() => {
    if (!mounted) return
    applyTheme(theme, systemTheme)
  }, [theme, systemTheme, mounted])

  const setTheme = React.useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem("theme", next)
    } catch {}
  }, [])

  const resolvedTheme = theme === "system" ? systemTheme : theme

  const value = React.useMemo(
    () => ({
      theme,
      setTheme,
      resolvedTheme: resolvedTheme as "light" | "dark",
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
