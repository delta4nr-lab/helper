// Спільні типи редактора документа (docx-editor).

// Поле шаблону = content control у DOCX (tag = key, alias = label).
export type EditorField = {
  key: string
  label: string
  type: string
}

// Людина зі штату (для заповнення груп полів та підпису).
export type EditorPersonnel = {
  id: string
  lastName: string
  firstName: string
  middleName: string | null
  rank: string
  position: string
  signaturePath: string | null
}
