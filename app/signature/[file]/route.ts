import { readFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

import { getSessionUser } from "@/lib/auth"
import { SIGNATURES_ROOT } from "@/lib/storage/paths"

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
}

// Роздача файлів підписів особового складу з приватного storage/signature.
// Підписи вбудовуються в документи редактором, тому читає будь-який
// авторизований користувач; анонімний доступ закритий.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const user = await getSessionUser()
  if (!user || !user.isActive) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { file } = await params
  const name = path.basename(file)
  if (!name || name === "." || name === "..") {
    return new NextResponse("Not found", { status: 404 })
  }

  const ext = path.extname(name).toLowerCase()
  const mime = MIME_BY_EXT[ext]
  if (!mime) {
    return new NextResponse("Not found", { status: 404 })
  }

  const filePath = path.resolve(SIGNATURES_ROOT, name)
  if (!filePath.startsWith(SIGNATURES_ROOT + path.sep)) {
    return new NextResponse("Not found", { status: 404 })
  }

  try {
    const data = await readFile(filePath)
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    })
  } catch {
    return new NextResponse("Not found", { status: 404 })
  }
}
