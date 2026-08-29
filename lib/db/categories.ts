import "server-only"
import { prisma } from "@/lib/db"

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findUnique({ where: { slug } })
}

export async function listCategoriesWithCounts() {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { templates: true } } },
  })
  return categories
}
