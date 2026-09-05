// Довідники готових полів для панелі адміна (права колонка редактора шаблона).
// Розширення = новий запис у FIELD_CATALOGS: панель рендерить заголовки,
// секції та кнопки з даних, без змін коду.
//
// Теги персоналу — чинний словник застосунку staff:* (той самий, що
// використовує заповнення полів персоналу в fill-panel).

import { Briefcase, PenLine, Shield, UserRound, type LucideIcon } from "lucide-react"

import type { InsertableContentControlType } from "@docx-editor.dev/core/contracts/editor"

export type CatalogField = {
  id: string
  /** Людська назва поля — кнопка в панелі й alias контрола (w:alias). */
  label: string
  /** Тег контрола (w:tag): словник застосунку, напр. staff:person. */
  tag: string
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
  fields: readonly CatalogField[]
}

export const FIELD_CATALOGS: readonly FieldCatalog[] = [
  {
    id: "personnel",
    title: "Поля персоналу",
    hint: "Підпис вставляється як поле — зображення підставиться під час заповнення.",
    fields: [
      { id: "person", label: "ПІБ", tag: "staff:person", subtype: "plainText", icon: UserRound },
      { id: "position", label: "Посада", tag: "staff:position", subtype: "plainText", icon: Briefcase },
      { id: "rank", label: "Звання", tag: "staff:rank", subtype: "plainText", icon: Shield },
      // Підпис: движок не вміє створювати picture-SDT, тому поки plainText.
      // Тег staff:signature — позначка типу; зображення підставить майбутня
      // логіка заповнення (у fill-panel вона вже вміє ставити підписи).
      { id: "signature", label: "Підпис", tag: "staff:signature", subtype: "plainText", icon: PenLine },
    ],
  },
]
