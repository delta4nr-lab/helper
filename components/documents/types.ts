// Спільні типи редактора документа.
// Використовуються в document-editor.tsx, hooks та UI-компонентах.

// Людина зі штату (для PersonPicker та заповнення спеціальних полів)
export type Personnel = {
  id: string
  lastName: string
  firstName: string
  middleName: string | null
  rank: string
  position: string
  signaturePath: string | null
}

// Поле, над яким наведена миша — для показу тригера вибору особи без зміни selection.
export type PickerTarget = {
  key: string
  type: string
  label: string
  pos: number
  x: number
  y: number
  hasSignature: boolean
  groupPersonId: string | null
}

// Вирівнювання зображення в документі
export type ImageAlignment = "left" | "center" | "right"

// Обране зображення в редакторі (для панелі редагування)
export type SelectedImage = {
  pos: number
  attrs: Record<string, unknown>
  x: number
  y: number
}

// Підпис/особа, прив'язана до групи полів
export type GroupInfo = {
  hasSignature: boolean
  groupPersonId: string | null
}