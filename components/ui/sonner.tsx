"use client"

import { Toaster as Sonner } from "sonner"

import { useTheme } from "@/components/theme-provider"

function Toaster() {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner theme={resolvedTheme} richColors closeButton position="bottom-right" />
  )
}

export { Toaster }
