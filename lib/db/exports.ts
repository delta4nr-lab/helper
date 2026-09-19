import "server-only"

import { or } from "@prisma/orm-postgres/orm-client"

import { orm } from "@/lib/db"
import { safeDocxFileName } from "@/lib/documents/filename"

export type ExportSort = "newest" | "oldest" | "title"

export type UserExportListItem = {
  id: string
  title: string
  fileName: string
  mimeType: string
  size: number
  createdAt: string
  templateTitle: string | null
  categorySlug: string | null
}

// Список документів користувача без важких байтів (`data` не вибирається).
// Пошук/сортування виконуються на рівні БД; пагінація — offset/limit.
export async function listUserExports(params: {
  userId: string
  q?: string
  sort?: ExportSort
  page?: number
  pageSize?: number
}): Promise<{
  items: UserExportListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}> {
  const { userId, q, sort = "newest", page = 1, pageSize = 10 } = params

  let collection = orm.ExportedFile
  collection = collection.where({ userId })

  const qq = q?.trim()
  if (qq) {
    collection = collection.where((e) =>
      or(e.title.ilike(`%${qq}%`), e.fileName.ilike(`%${qq}%`))
    )
  }

  if (sort === "oldest") {
    collection = collection.orderBy((e) => e.createdAt.asc())
  } else if (sort === "title") {
    collection = collection.orderBy((e) => e.title.asc())
  } else {
    collection = collection.orderBy((e) => e.createdAt.desc())
  }

  const [rows, totalAgg] = await Promise.all([
    collection
      .select("id", "title", "fileName", "mimeType", "size", "createdAt", "templateId")
      .include("template", (t) => t.select("title", "categorySlug"))
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .all(),
    collection.aggregate((agg) => ({ count: agg.count() })),
  ])

  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      fileName: row.fileName,
      mimeType: row.mimeType,
      size: row.size,
      createdAt: String(row.createdAt),
      templateTitle: row.template?.title ?? null,
      categorySlug: row.template?.categorySlug ?? null,
    })),
    total: totalAgg.count,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalAgg.count / pageSize)),
  }
}

// Видалення з перевіркою власника безпосередньо у запиті: WHERE id + userId.
export async function deleteExport(params: {
  id: string
  userId: string
}): Promise<boolean> {
  const { id, userId } = params
  const found = await orm.ExportedFile.where({ id, userId })
    .select("id")
    .first()
  if (!found) return false
  await orm.ExportedFile.where({ id, userId }).delete()
  return true
}

// Перейменування документа: title + безпечне ім'я файлу. Власник —
// безпосередньо у WHERE (id + userId).
export async function renameExport(params: {
  id: string
  userId: string
  title: string
}): Promise<{ fileName: string } | null> {
  const { id, userId, title } = params
  const fileName = safeDocxFileName(title)
  const found = await orm.ExportedFile.where({ id, userId })
    .select("id")
    .first()
  if (!found) return null
  await orm.ExportedFile.where({ id, userId }).update({ title, fileName })
  return { fileName }
}
