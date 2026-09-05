// Реєстр типів кастомних полів заповнення, які адмін може вставити в документ
// через команду insertContentControl. Точка розширення: новий тип = новий запис.
//
// Checkbox у цій ітерації відкладено свідомо: рушій (@docx-editor.dev) вміє
// створювати лише plainText/date/richText/dropdown/comboBox — нативний Word
// checkbox (w14:checkbox) він читає та заповнює, але не створює. Додамо його
// разом із логікою заповнення полів.

import type { InsertableContentControlType } from "@docx-editor.dev/core/contracts/editor"

export type CustomFieldTypeId = "plainText" | "date"

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
  {
    id: "date",
    label: "Дата",
    hint: "Дата; під час заповнення Word показує вибір дати.",
    subtype: "date",
  },
]
