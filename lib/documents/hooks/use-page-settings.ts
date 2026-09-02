"use client"

import * as React from "react"
import { pageSettingsFromPaper, pageSizePx, type PageSettings } from "@/lib/documents/page"
import {
  readStoredPageSettings,
  clearStoredPageSettings,
  subscribePageSettings,
  writeStoredPageSettings,
} from "@/lib/documents/page-store"

// Налаштування сторінки для конкретного документа (localStorage за templateId).
// Власник page-домену: розміри, поля, збереження/скидання.
export function usePageSettings(templateId: string, paper?: string | null) {
  const fallbackPage = React.useMemo(() => pageSettingsFromPaper(paper), [paper])

  // Кешуємо snapshot: useSyncExternalStore порівнює попередній і новий результат,
  // щоб уникнути зайвих ре-рендерів та infinite loop.
  const snapshotRef = React.useRef<PageSettings | null>(null)
  const getSnapshot = React.useCallback(() => {
    const next = readStoredPageSettings(templateId) ?? fallbackPage
    if (!snapshotRef.current || JSON.stringify(snapshotRef.current) !== JSON.stringify(next)) {
      snapshotRef.current = next
    }
    return snapshotRef.current
  }, [templateId, fallbackPage])
  const page = React.useSyncExternalStore(subscribePageSettings, getSnapshot, getSnapshot)

  const pagePx = React.useMemo(() => pageSizePx(page), [page])

  const applyPageSettings = React.useCallback(
    (next: PageSettings) => {
      writeStoredPageSettings(templateId, next)
    },
    [templateId]
  )

  const resetPageSettings = React.useCallback(() => {
    clearStoredPageSettings(templateId)
  }, [templateId])

  return { page, fallbackPage, pagePx, applyPageSettings, resetPageSettings }
}