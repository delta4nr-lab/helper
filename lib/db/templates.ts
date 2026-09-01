import "server-only"

import { orm } from "@/lib/db"
import { or } from "@prisma/orm-postgres/orm-client"

export async function listTemplates(params?: { categorySlug?: string; popular?: boolean; q?: string }) {
  let collection = orm.Template
  if (params?.categorySlug) collection = collection.where({ categorySlug: params.categorySlug })
  if (typeof params?.popular === "boolean") collection = collection.where({ popular: params.popular })
  if (params?.q) {
    const q = params.q.trim()
    if (q) {
      collection = collection.where((t) => or(t.title.ilike(`%${q}%`), t.description.ilike(`%${q}%`)))
    }
  }
  const rows = await collection.orderBy((t) => t.title.asc()).all()
  return rows.sort((a, b) => Number(b.popular) - Number(a.popular))
}

export async function getTemplate(id: string) {
  return orm.Template.first({ id })
}

export async function getTemplateWithFields(id: string) {
  return orm.Template.where({ id })
    .include("templateFields", (f) => f.orderBy((field) => field.sortOrder.asc()))
    .include("category", (c) => c)
    .first()
}

export async function getCategoryCounts() {
  const counts = await orm.Template.groupBy("categorySlug").aggregate((agg) => ({ count: agg.count() }))
  return counts.map((c) => ({ categorySlug: c.categorySlug, count: c.count }))
}

export async function listCategories() {
  return orm.Category.where({ isActive: true }).orderBy((c) => c.sortOrder.asc()).all()
}