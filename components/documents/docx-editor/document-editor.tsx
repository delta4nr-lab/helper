"use client"

import nextDynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

import type { PersonnelEntry } from "@/components/documents/docx-editor/personnel-panel"
import type { CourseRecordData } from "@/lib/courses/types"

// Редактор Docx рендериться лише в браузері (SSR кидає помилку), тому динамічний імпорт.
const DocumentWorkspace = nextDynamic(() => import("./document-workspace"), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center gap-2 rounded-lg border text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      Завантаження редактора...
    </div>
  ),
})

type Props = {
  templateId: string
  title: string
  /** Джерело DOCX-байтів (адмін-редактор шаблонів: /api/admin/templates/[id]/docx) */
  docxUrl?: string
  /** "template": кнопка збереження пише байти в Template через exportHandler */
  mode?: "document" | "template"
  /** Серверний action збереження шаблона */
  exportHandler?: (formData: FormData) => Promise<{ ok: boolean; message: string }>
  /** Додаткові елементи у верхньому рядку редактора */
  titleActions?: React.ReactNode
  /** Панель праворуч від документа (усередині Root — контекст редактора доступний) */
  sidePanel?: React.ReactNode
  /** Довідник персоналу для персональних полів (template-режим) */
  personnel?: PersonnelEntry[]
  /** Курсанти з активного курсу (template-режим, cadet.{i}.{f}-ноди) */
  cadets?: readonly CourseRecordData[]
}

export function DocumentEditor({
  templateId,
  title,
  docxUrl,
  mode,
  exportHandler,
  titleActions,
  sidePanel,
  personnel,
  cadets,
}: Props) {
  return (
    <div className="flex h-[calc(100svh-9rem)] min-h-[32rem] flex-col overflow-hidden rounded-lg border">
      <DocumentWorkspace
        templateId={templateId}
        title={title}
        docxUrl={docxUrl}
        mode={mode}
        exportHandler={exportHandler}
        titleActions={titleActions}
        sidePanel={sidePanel}
        personnel={personnel}
        cadets={cadets}
      />
    </div>
  )
}
