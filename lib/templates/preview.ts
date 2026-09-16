import "server-only"

import { orm } from "@/lib/db"

// Прев'ю шаблону для головної сторінки: обираємо ОДИН випадковий активний
// DOCX-шаблон і передаємо клієнту лише { id, title }. Байти DOCX клієнт
// тягне окремо з публічного роута і рендерить через docx-preview — це
// зберігає структуру документа такою, як вона задумана в шаблоні.

export type TemplatePreviewDoc = {
  id: string
  title: string
}

export async function getPreviewDoc(): Promise<TemplatePreviewDoc | null> {
  // Легкий запит: тільки id/title активних шаблонів, без docxData.
  const templates = await orm.Template.select("id", "title")
    .where({ isActive: true })
    .orderBy((t) => t.updatedAt.desc())
    .all()

  if (templates.length === 0) return null

  const picked = templates[Math.floor(Math.random() * templates.length)]
  return { id: picked.id, title: picked.title }
}
