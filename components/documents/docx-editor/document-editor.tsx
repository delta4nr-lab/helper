"use client"

import nextDynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

import type { EditorField, EditorPersonnel } from "@/components/documents/types"

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
  fields: EditorField[]
  personnel: EditorPersonnel[]
}

export function DocumentEditor({ templateId, title, fields, personnel }: Props) {
  return (
    <div className="flex h-[calc(100svh-9rem)] min-h-[32rem] flex-col overflow-hidden rounded-lg border">
      {/* key: зміна шаблона перемонтовує робочу область — редагована назва
          і всі локальні стани починаються заново */}
      <DocumentWorkspace key={templateId} templateId={templateId} title={title} fields={fields} personnel={personnel} />
    </div>
  )
}
