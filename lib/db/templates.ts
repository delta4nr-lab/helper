import "server-only"

import { prisma } from "@/lib/db"

export async function listTemplates(params?: { categorySlug?: string; popular?: boolean; q?: string }) {
  const where: Record<string, unknown> = {}
  if (params?.categorySlug) where.categorySlug = params.categorySlug
  if (typeof params?.popular === "boolean") where.popular = params.popular
  if (params?.q) {
    const q = params.q.trim()
    if (q) {
      ;(where as Record<string, unknown>).OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ]
    }
  }
  return prisma.template.findMany({
    where: where as never,
    orderBy: [{ popular: "desc" }, { title: "asc" }],
  })
}

export async function getTemplate(id: string) {
  return prisma.template.findUnique({ where: { id } })
}

export async function getTemplateWithFields(id: string) {
  return prisma.template.findUnique({
    where: { id },
    include: { fieldsConfig: { orderBy: { sortOrder: "asc" } }, category: true },
  })
}

export async function getCategoryCounts() {
  const [categories, counts] = await Promise.all([
    prisma.template.findMany({ distinct: ["categorySlug"], select: { categorySlug: true } }),
    prisma.template.groupBy({ by: ["categorySlug"], _count: true }),
  ])
  void categories
  return counts.map((c) => ({ categorySlug: c.categorySlug, count: c._count }))
}

export async function listCategories() {
  return prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } })
}
