import "dotenv/config"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"

import { db, orm } from "../src/prisma/db"

function sniff(buffer: Buffer): string {
  if (buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "image/png"
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg"
  if (buffer.length >= 6 && buffer.toString("ascii", 0, 3) === "GIF") return "image/gif"
  if (buffer.length > 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 4) === "WEBP") return "image/webp"
  if (buffer.length >= 2 && buffer[0] === 0x42 && buffer[1] === 0x4d) return "image/bmp"
  if (buffer.length > 4 && buffer.toString("ascii", 0, 4) === "%PDF") return "application/pdf"
  if (buffer.length > 5 && buffer.toString("utf8", 0, 5) === "<svg ") return "image/svg+xml"
  return "unknown"
}

// SOF-маркер JPEG → розмірності (як в upload route)
function jpegDims(buffer: Buffer): { width: number; height: number } | null {
  let i = 2
  while (i < buffer.length - 8) {
    if (buffer[i] !== 0xff) { i += 1; continue }
    const marker = buffer[i + 1]
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) }
    }
    const length = buffer.readUInt16BE(i + 2)
    i += 2 + length
  }
  return null
}

async function main() {
  const images = await orm.Image.select("id", "path", "mimeType", "width", "height").all()
  console.log(`DB rows: ${images.length}`)
  for (const image of images) {
    const relative = image.path.replace(/^\//, "")
    const filePath = path.join(process.cwd(), "public", relative)
    if (!existsSync(filePath)) {
      console.log(`NO FILE  ${image.path}`)
      continue
    }
    const buffer = readFileSync(filePath)
    const sniffed = sniff(buffer)
    const ext = path.extname(filePath)
    const dims = sniffed === "image/jpeg" ? jpegDims(buffer) : null
    console.log(
      `${sniffed === image.mimeType ? "ok  " : "MIME MISMATCH"}  sniff=${sniffed}  dbMime=${image.mimeType}  ext=${ext}  ${buffer.length}B  dims=${dims ? `${dims.width}x${dims.height}` : "?"}  dbDims=${image.width}x${image.height}  ${image.path}`
    )
  }

  const dir = path.join(process.cwd(), "public", "uploads", "users")
  for (const user of readdirSync(dir)) {
    const imagesDir = path.join(dir, user, "images")
    try {
      for (const file of readdirSync(imagesDir)) {
        if (!images.some((image) => image.path.endsWith(file))) {
          console.log(`ON DISK BUT NO DB ROW: ${file}`)
        }
      }
    } catch {}
  }
  await db.close()
}

void main()
