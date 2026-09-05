import { COURSE_FIELD_TYPES } from "@/lib/courses/types"

// Типи полів заповнення: базові + персонал + автопідстановка з активного курсу
// (у TemplateField._type; курсові — з префіксом "course:").
export const TEMPLATE_FIELD_TYPES = [
  "text",
  "date",
  "number",
  "person",
  "position",
  "rank",
  "signature",
  ...COURSE_FIELD_TYPES,
] as const

export type TemplateFieldType = (typeof TEMPLATE_FIELD_TYPES)[number]

export const PAPERS = ["А4", "А4 альбом"] as const
export type TemplatePaper = (typeof PAPERS)[number]
