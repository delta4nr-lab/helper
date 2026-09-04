import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
}

// Роздача файлів бібліотеки користувача з public/uploads.
// Turbopack (dev) і next start снапшотять public на старті сервера, тож файли,
// записані після запуску (upload у рантаймі), статикою не віддаються (404).
// Читаємо з диска напряму — нові завантаження доступні без перезапуску.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params
  if (!segments.some(Boolean)) {
    return new NextResponse("Not found", { status: 404 })
  }

  const ext = path.extname(segments[segments.length - 1]).toLowerCase()
  const mime = MIME_BY_EXT[ext]
  if (!mime) {
    return new NextResponse("Not found", { status: 404 })
  }

  const root = path.join(process.cwd(), "public", "uploads")
  const filePath = path.join(root, ...segments)
  // Захист від path traversal: шлях мусить лишатися всередині public/uploads
  if (!path.resolve(filePath).startsWith(root + path.sep)) {
    return new NextResponse("Not found", { status: 404 })
  }

  try {
    const file = await readFile(filePath)
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": mime,
        // Імена файлів — UUID, вміст не змінюється, тому агресивне кешування безпечне
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    })
  } catch {
    return new NextResponse("Not found", { status: 404 })
  }
}
