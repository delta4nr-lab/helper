import "server-only"
import { orm } from "@/lib/db"

export async function getCategoryBySlug(slug: string) {
  return orm.Category.first({ slug })
}

export async function listCategoriesWithCounts() {
  return orm.Category.where({ isActive: true })
    .orderBy([(c) => c.sortOrder.asc(), (c) => c.title.asc()])
    .include("templates", (t) => t.count())
    .all()
}