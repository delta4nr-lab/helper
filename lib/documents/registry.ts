import { raportVidpustkaSchema, raportVidpustkaTitle, type RaportVidpustkaData } from "@/lib/documents/schemas/raport-vidpustka"
import { raportVidryadzhennyaSchema, raportVidryadzhennyaTitle, type RaportVidryadzhennyaData } from "@/lib/documents/schemas/raport-vidryadzhennya"

// Реєстр схем — Документ Дані → Схема → Валідація
// Додавання нового типу: створити schemas/<id>.ts + зареєструвати тут
// Зараз активний тільки raport-vidryadzhennya (єдиний рапорт), vidpustka лишено для сумісності

export type DocumentSchemaEntry = {
  schema: import("zod").ZodTypeAny
  title: (data: unknown) => string
}

export const documentSchemas: Record<string, DocumentSchemaEntry> = {
  "raport-vidpustka": {
    schema: raportVidpustkaSchema,
    title: (data) => {
      const d = data as Partial<RaportVidpustkaData>
      return raportVidpustkaTitle(d)
    },
  },
  "raport-vidryadzhennya": {
    schema: raportVidryadzhennyaSchema,
    title: (data) => {
      const d = data as Partial<RaportVidryadzhennyaData>
      return raportVidryadzhennyaTitle(d)
    },
  },
}

export function getDocumentSchema(templateId: string) {
  return documentSchemas[templateId] ?? null
}

export function validateDocumentData(templateId: string, data: unknown) {
  const entry = getDocumentSchema(templateId)
  if (!entry) return { success: true as const, data } // невідомий шаблон — пропустити (JSON)
  const parsed = entry.schema.safeParse(data)
  if (!parsed.success) return { success: false as const, error: parsed.error }
  return { success: true as const, data: parsed.data }
}
