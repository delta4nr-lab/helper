// Кастомне поле (діалог «Додати поле») — лише текстове. Date-поля вилучено
// як невикористовувані; повернути = додати запис у реєстр.

import type { InsertableContentControlType } from "@docx-editor.dev/core/contracts/editor"

export type CustomFieldTypeId = "plainText"

export type CustomFieldTypeDef = {
  id: CustomFieldTypeId
  /** Видима назва типу в діалозі. */
  label: string
  /** Підказка, для чого поле. */
  hint: string
  /** subtype команди insertContentControl. */
  subtype: InsertableContentControlType
}

export const CUSTOM_FIELD_TYPES: readonly CustomFieldTypeDef[] = [
  {
    id: "plainText",
    label: "Текст",
    hint: "Вільний текст: ПІБ, назва, число тощо.",
    subtype: "plainText",
  },
]
