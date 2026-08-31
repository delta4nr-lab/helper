import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"

import { auth } from "@/auth"

// PNG/JPEG лише — DOCX не підтримує вбудовування WebP
const ALLOWED = ["image/png", "image/jpeg"]
const MAX_SIZE = 2 * 1024 * 1024 // 2 МБ

export async function POST(request: Request) {
  const session = await (auth as unknown as () => Promise<{ user?: { id?: string; role?: string } } | null>)()
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ message: "Недостатньо прав" }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file")
  if (!(file instanceof File)) return NextResponse.json({ message: "Файл не отримано" }, { status: 400 })
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ message: "Дозволені лише PNG, JPEG" }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ message: "Файл завеликий (макс 2 МБ)" }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
  const name = `sig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const dir = path.join(process.cwd(), "public", "signature")
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, name), buffer)

  return NextResponse.json({ path: `/signature/${name}` })
}