import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

import { getSessionUser } from "@/lib/auth"
import { IMAGES_ROOT } from "@/lib/storage/paths"

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
}

// Роздача зображень бібліотеки користувача з приватного storage/uploads.
// Файли поза public/, тому доступ лише тут — з перевіркою сесії та власника.
// URL не змінюється (/uploads/users/{userId}/images/{file}).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const user = await getSessionUser()
  if (!user || !user.isActive) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { path: segments } = await params
  if (!segments?.length || !segments.some(Boolean)) {
    return new NextResponse("Not found", { status: 404 })
  }

  // Очікуємо users/{userId}/images/{file}: власник або адмін.
  if (segments[0] !== "users" || !segments[1]) {
    return new NextResponse("Not found", { status: 404 })
  }
  if (segments[1] !== user.id && user.role !== "ADMIN") {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const ext = path.extname(segments[segments.length - 1]).toLowerCase()
  const mime = MIME_BY_EXT[ext]
  if (!mime) {
    return new NextResponse("Not found", { status: 404 })
  }

  const filePath = path.join(IMAGES_ROOT, ...segments)
  // Захист від path traversal: шлях мусить лишатися всередині storage/uploads
  if (!path.resolve(filePath).startsWith(IMAGES_ROOT + path.sep)) {
    return new NextResponse("Not found", { status: 404 })
  }

  try {
    const file = await readFile(filePath)
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": mime,
        // Приватне кешування: вміст незмінний (UUID-імена), але файл — користувача
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    })
  } catch {
    return new NextResponse("Not found", { status: 404 })
  }
}
