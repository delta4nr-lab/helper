import "server-only"

import path from "node:path"

// Приватне сховище завантажених файлів — ПОЗА public/, тому Next їх не
// роздає статично. Доступ лише через route handlers з перевіркою сесії.
// Шлях можна перевизначити змінною UPLOADS_DIR (напр. змонтований том).
export const PRIVATE_ROOT =
  process.env.UPLOADS_DIR ?? path.join(process.cwd(), "storage")

// Відповідає URL-префіксу /uploads/... → storage/uploads/...
export const IMAGES_ROOT = path.join(PRIVATE_ROOT, "uploads")

// Відповідає URL-префіксу /signature/... → storage/signature/...
export const SIGNATURES_ROOT = path.join(PRIVATE_ROOT, "signature")
