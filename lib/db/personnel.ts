import "server-only"

import { orm, nowTimestamp } from "@/lib/db"
import { or } from "@prisma/orm-postgres/orm-client"

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
  let collection = orm.Personnel
  if (q) {
    const qq = q.trim()
    if (qq) {
      collection = collection.where((p) =>
        or(
          p.lastName.ilike(`%${qq}%`),
          p.firstName.ilike(`%${qq}%`),
          p.middleName.ilike(`%${qq}%`),
          p.rank.ilike(`%${qq}%`),
          p.position.ilike(`%${qq}%`),
          p.unit.ilike(`%${qq}%`),
        )
      )
    }
  }
  if (unit) collection = collection.where({ unit })
  if (status) collection = collection.where({ status })
  collection = collection.orderBy((p) => {
    const column = orderBy === "createdAt" ? p.createdAt : orderBy === "rank" ? p.rank : p.lastName
    return orderDir === "desc" ? column.desc() : column.asc()
  })

  const [items, total] = await Promise.all([
    collection.offset((page - 1) * pageSize).limit(pageSize).all(),
    collection.aggregate((agg) => ({ count: agg.count() })),
  ])
  return { items, total: total.count, page, pageSize, totalPages: Math.ceil(total.count / pageSize) }
}

export async function getPersonnel(id: string) {
  return orm.Personnel.first({ id })
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
  return orm.Personnel.create({ ...data, updatedAt: nowTimestamp() })
}