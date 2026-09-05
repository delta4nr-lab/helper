// Довідники готових полів для панелі адміна (права колонка редактора шаблона).
// Розширення = новий запис у FIELD_CATALOGS: панель рендерить заголовки,
// секції та кнопки з даних, без змін коду.
//
// Номерні довідники (numbered): панель показує лічильник записів (людей),
// тег і назва поля будуються з індексом — staff.1.fullName, «ПІБ (2)».
// Заповнення потім підставляє дані строго потрібної людини за індексом у тезі.

import { Briefcase, PenLine, Shield, UserRound, type LucideIcon } from "lucide-react"

import type { InsertableContentControlType } from "@docx-editor.dev/core/contracts/editor"

export type CatalogField = {
  id: string
  /** Людська назва поля — кнопка в панелі; для неномерних — alias контрола. */
  label: string
  /** Статичний тег контрола (w:tag) для неномерних довідників; номерні
      будують тег через getStaffTag у момент вставки. */
  tag?: string
  /** subtype команди insertContentControl. */
  subtype: InsertableContentControlType
  icon: LucideIcon
}

export type FieldCatalog = {
  id: string
  /** Заголовок панелі/секції довідника. */
  title: string
  /** Підказка внизу секції (необов'язкова). */
  hint?: string
  /** Номерний довідник: лічильник записів на панелі, тег/назва з індексом. */
  numbered?: boolean
  /** Максимум лічильника (для numbered). */
  maxIndex?: number
  fields: readonly CatalogField[]
}

export const FIELD_CATALOGS: readonly FieldCatalog[] = [
  {
    id: "personnel",
    title: "Поля персоналу",
    hint: "Підпис вставляється як поле — зображення підставиться під час заповнення.",
    numbered: true,
    maxIndex: 5,
    fields: [
      { id: "fullName", label: "ПІБ", subtype: "plainText", icon: UserRound },
      { id: "position", label: "Посада", subtype: "plainText", icon: Briefcase },
      { id: "rank", label: "Звання", subtype: "plainText", icon: Shield },
      // Підпис: движок не вміє створювати picture-SDT, тому поки plainText.
      // Тег staff.N.signature — позначка типу; зображення підставить майбутня
      // логіка заповнення (у fill-panel вона вже вміє ставити підписи).
      { id: "signature", label: "Підпис", subtype: "plainText", icon: PenLine },
    ],
  },
]

// Тег поля персоналу з індексом людини: staff.1.fullName, staff.2.position…
// Заповнення цілиться строго у людину за індексом у тезі.
export function getStaffTag(index: number, field: string): string {
  return `staff.${index}.${field}`
}

// Зворотний розбір тега персоналу — для майбутнього заповнення за індексом.
export function parseStaffTag(tag: string): { index: number; field: string } | null {
  const match = tag.match(/^staff\.(\d+)\.([a-zA-Z][a-zA-Z0-9_]*)$/)
  return match ? { index: Number(match[1]), field: match[2] } : null
}

// Назва поля номерного довідника: «ПІБ (2)».
export function getNumberedFieldTitle(label: string, index: number): string {
  return `${label} (${index})`
}
