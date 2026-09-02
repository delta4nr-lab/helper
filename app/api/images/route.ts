import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { orm } from "@/lib/db"

// Список зображень поточного користувача (лише свої). Пошук за іменем файлу.
export async function GET(request: Request) {
  const session = await (auth as unknown as () => Promise<{ user?: { id?: string } } | null>)()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ message: "Не авторизовано. Увійдіть у систему." }, { status: 401 })

  const url = new URL(request.url)
  const q = url.searchParams.get("q")?.trim() ?? ""
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1)
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "50") || 50))

  let collection = orm.Image
  if (q) {
    collection = collection.where((img) => img.originalFilename.ilike(`%${q}%`))
  }
  collection = collection.where({ userId })
  collection = collection.orderBy((img) => img.createdAt.desc())

  const [items, total] = await Promise.all([
    collection.offset((page - 1) * pageSize).limit(pageSize).all(),
    collection.aggregate((agg) => ({ count: agg.count() })),
  ])

  return NextResponse.json({
    images: items.map((img) => ({
      id: img.id,
      filename: img.filename,
      originalFilename: img.originalFilename,
      path: img.path,
      mimeType: img.mimeType,
      size: img.size,
      width: img.width,
      height: img.height,
      createdAt: img.createdAt,
    })),
    total: total.count,
    page,
    pageSize,
  })
}