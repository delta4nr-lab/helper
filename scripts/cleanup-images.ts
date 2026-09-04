import "dotenv/config"
import { existsSync } from "node:fs"
import path from "node:path"

import { db, orm } from "../src/prisma/db"

// Одноразове прибирання: видаляє записи Image, файли яких відсутні на диску
// (осиротілі після втрати public/uploads під час переробок).
async function main() {
  const images = await orm.Image.select("id", "path").all()
  let removed = 0
  for (const image of images) {
    const relative = image.path.replace(/^\//, "")
    const filePath = path.join(process.cwd(), "public", relative)
    if (!existsSync(filePath)) {
      await orm.Image.where({ id: image.id }).delete()
      removed++
      console.log(`removed  ${image.path}`)
    }
  }
  console.log(`Removed ${removed} orphaned rows of ${images.length}.`)
  await db.close()
}

void main()
