import "server-only"

import { prisma } from "@/lib/db"

export async function listDocuments(params: {
  templateId?: string
  categorySlug?: string
  personnelId?: string
  status?: string
  q?: string
  page?: number
  pageSize?: number
}) {
  const { templateId, categorySlug, personnelId, status, q, page = 1, pageSize = 20 } = params
  const where: Record<string, unknown> = {}
  if (templateId) where.templateId = templateId
  if (categorySlug) where.categorySlug = categorySlug
  if (personnelId) where.personnelId = personnelId
  if (status) where.status = status
  if (q) {
    const qq = q.trim()
    if (qq) where.title = { contains: qq, mode: "insensitive" }
  }

  const [items, total] = await Promise.all([
    prisma.document.findMany({
      where: where as never,
      include: { template: true, personnel: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.document.count({ where: where as never }),
  ])
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export async function getDocument(id: string) {
  return prisma.document.findUnique({
    where: { id },
    include: { template: true, personnel: true },
  })
}

export async function createDocument(data: {
  templateId: string
  categorySlug: string
  title: string
  dataJson: unknown
  personnelId?: string
}) {
  return prisma.document.create({
    data: {
      templateId: data.templateId,
      categorySlug: data.categorySlug,
      title: data.title,
      data: data.dataJson as never,
      personnelId: data.personnelId,
    },
  })
}
