import "server-only"

import { rm } from "node:fs/promises"
import path from "node:path"

import { orm } from "@/lib/db"

export type MediaSort = "newest" | "oldest" | "name"

export type UserMediaListItem = {
  id: string
  originalFilename: string
  path: string
  mimeType: string
  size: number
  width: number
  height: number
  createdAt: string
}

export async function listUserImages(params: {
  userId: string
  q?: string
  sort?: MediaSort
  page?: number
  pageSize?: number
}): Promise<{
  items: UserMediaListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}> {
  const { userId, q, sort = "newest", page = 1, pageSize = 12 } = params

  let collection = orm.Image
  collection = collection.where({ userId })

  const qq = q?.trim()
  if (qq) {
    collection = collection.where((img) =>
      img.originalFilename.ilike(`%${qq}%`)
    )
  }

  if (sort === "oldest") {
    collection = collection.orderBy((img) => img.createdAt.asc())
  } else if (sort === "name") {
    collection = collection.orderBy((img) => img.originalFilename.asc())
  } else {
    collection = collection.orderBy((img) => img.createdAt.desc())
  }

  const [rows, totalAgg] = await Promise.all([
    collection
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .all(),
    collection.aggregate((agg) => ({ count: agg.count() })),
  ])

  return {
    items: rows.map((row) => ({
      id: row.id,
      originalFilename: row.originalFilename,
      path: row.path,
      mimeType: row.mimeType,
      size: row.size,
      width: row.width,
      height: row.height,
      createdAt: String(row.createdAt),
    })),
    total: totalAgg.count,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(totalAgg.count / pageSize)),
  }
}

// Видалення з перевіркою власника у запитах: WHERE id + userId і для
// читання рядка, і для самого delete. Файл на диску прибираємо після рядка.
export async function deleteImage(params: {
  id: string
  userId: string
}): Promise<boolean> {
  const { id, userId } = params
  const image = await orm.Image.where({ id, userId }).first()
  if (!image) return false

  await orm.Image.where({ id, userId }).delete()
  await removeUploadedFile(image.path)
  return true
}

const PUBLIC_ROOT = path.join(process.cwd(), "public")
const UPLOADS_ROOT = path.join(PUBLIC_ROOT, "uploads")

// Видаляємо лише файли всередині public/uploads — з захистом від path traversal.
async function removeUploadedFile(publicPath: string): Promise<void> {
  if (!publicPath.startsWith("/uploads/")) return

  const relative = publicPath.replace(/^[/\\]+/, "")
  const absolute = path.resolve(PUBLIC_ROOT, relative)
  const uploadsWithSep = UPLOADS_ROOT + path.sep
  if (!absolute.startsWith(uploadsWithSep)) return

  await rm(absolute, { force: true }).catch(() => {})
}
