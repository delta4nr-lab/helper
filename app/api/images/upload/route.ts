import { mkdir, writeFile, rm } from "node:fs/promises"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { orm, nowTimestamp } from "@/lib/db"

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"])
const MAX_SIZE = 10 * 1024 * 1024 // 10 МБ

// Визначення розмірів зображення (px) без завантаження сторонніх бібліотек.
function imageDimensions(buffer: Buffer): { width: number; height: number } {
  // PNG: signature + length + "IHDR" + width/height (big-endian)
  if (buffer.length > 24 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }
  // JPEG: шукаємо SOF-маркер
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let i = 2
    while (i < buffer.length - 8) {
      if (buffer[i] !== 0xff) {
        i += 1
        continue
      }
      const marker = buffer[i + 1]
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: buffer.readUInt16BE(i + 7), height: buffer.readUInt16BE(i + 5) }
      }
      const length = buffer.readUInt16BE(i + 2)
      i += 2 + length
    }
  }
  // WEBP: RIFF....WEBP
  if (buffer.length > 30 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buffer.toString("ascii", 12, 16)
    if (chunk === "VP8 " && buffer.length >= 30) {
      const w = buffer.readUInt16LE(26) & 0x3fff
      const h = buffer.readUInt16LE(28) & 0x3fff
      if (w > 0 && h > 0) return { width: w, height: h }
    }
    if (chunk === "VP8L" && buffer.length >= 30) {
      const b0 = buffer[21]
      const b1 = buffer[22]
      const b2 = buffer[23]
      const b3 = buffer[24]
      const w = 1 + (((b1 & 0x3f) << 8) | b0)
      const h = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6))
      if (w > 0 && h > 0) return { width: w, height: h }
    }
  }
  return { width: 0, height: 0 }
}

// Upload зображення в бібліотеку поточного користувача.
// userId визначається server-side з сесії — жодних userId з тіла запиту.
export async function POST(request: Request) {
  const session = await (auth as unknown as () => Promise<{ user?: { id?: string } } | null>)()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ message: "Не авторизовано. Увійдіть у систему." }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get("file")
  if (!(file instanceof File)) return NextResponse.json({ message: "Файл не отримано" }, { status: 400 })

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ message: "Дозволені лише JPG, PNG, WEBP." }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ message: "Файл завеликий (максимум 10 МБ)." }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp"
  const filename = `${randomUUID()}.${ext}`
  const dir = path.join(process.cwd(), "public", "uploads", "users", userId, "images")
  await mkdir(dir, { recursive: true })
  const filePath = path.join(dir, filename)
  await writeFile(filePath, buffer)

  const { width, height } = imageDimensions(buffer)
  const imagePath = `/uploads/users/${userId}/images/${filename}`

  try {
    const image = await orm.Image.select("id", "path", "width", "height").create({
      userId,
      filename,
      originalFilename: file.name,
      path: imagePath,
      mimeType: file.type,
      size: buffer.length,
      width,
      height,
      createdAt: nowTimestamp(),
    })
    return NextResponse.json({ id: image.id, path: image.path, width: image.width, height: image.height })
  } catch (error) {
    console.error("[ImageUpload] create failed:", error)
    await rm(filePath, { force: true }).catch(() => {})
    return NextResponse.json({ message: "Не вдалося зберегти зображення." }, { status: 500 })
  }
}