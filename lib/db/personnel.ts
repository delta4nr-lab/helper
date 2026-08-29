import "server-only"

import { prisma } from "@/lib/db"

export type PersonnelOrderBy = "lastName" | "createdAt" | "rank"

export async function listPersonnel(params: {
  q?: string
  unit?: string
  status?: string
  orderBy?: PersonnelOrderBy
  orderDir?: "asc" | "desc"
  page?: number
  pageSize?: number
}) {
  const { q, unit, status, orderBy = "lastName", orderDir = "asc", page = 1, pageSize = 20 } = params
  const where: Record<string, unknown> = {}
  if (q) {
    const qq = q.trim()
    if (qq) {
      ;(where as Record<string, unknown>).OR = [
        { lastName: { contains: qq, mode: "insensitive" } },
        { firstName: { contains: qq, mode: "insensitive" } },
        { middleName: { contains: qq, mode: "insensitive" } },
        { rank: { contains: qq, mode: "insensitive" } },
        { position: { contains: qq, mode: "insensitive" } },
        { unit: { contains: qq, mode: "insensitive" } },
      ]
    }
  }
  if (unit) (where as Record<string, string>).unit = unit
  if (status) (where as Record<string, string>).status = status

  const [items, total] = await Promise.all([
    prisma.personnel.findMany({
      where: where as never,
      orderBy: { [orderBy]: orderDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.personnel.count({ where: where as never }),
  ])
  return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}

export async function getPersonnel(id: string) {
  return prisma.personnel.findUnique({ where: { id } })
}

export async function createPersonnel(data: {
  lastName: string
  firstName: string
  middleName?: string
  rank: string
  position: string
  unit: string
  status?: string
}) {
  return prisma.personnel.create({ data })
}
