// Типи для вкладок профілю (спільні між серверною сторінкою та клієнтськими списками).

export type DocumentItem = {
  id: string
  title: string
  fileName: string
  mimeType: string
  sizeLabel: string
  createdAtLabel: string
  templateTitle: string | null
}

export type MediaItem = {
  id: string
  originalFilename: string
  path: string
  sizeLabel: string
  dimensionsLabel: string
  createdAtLabel: string
}

export type SortOption = {
  value: string
  label: string
}

export type ListQuery = {
  tab: "documents" | "media"
  q: string
  sort: string
  page: number
}
