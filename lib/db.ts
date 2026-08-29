import "server-only"

import { PrismaClient } from "@/lib/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { normalizeDatabaseUrl } from "@/lib/db/connection-string"

// Best practice 2026 (Prisma docs: @prisma/adapter-pg + custom output)
// Для Prisma Postgres (db.prisma.io) та Next.js App Router — driver adapter
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — перевірте .env / .env.local")
  }
  const adapter = new PrismaPg({
    connectionString: normalizeDatabaseUrl(connectionString),
  })
  return new PrismaClient({ adapter })
}

let prismaInstance: PrismaClient | undefined = globalForPrisma.prisma
if (!prismaInstance) {
  try {
    prismaInstance = createPrismaClient()
  } catch (e) {
    // Не кидати під час збірки статичних сторінок без БД — даємо змогу fallback на catalog
    console.warn("[prisma] failed to create client:", (e as Error).message)
  }
  if (prismaInstance && process.env.NODE_ENV !== "production") globalForPrisma.prisma = prismaInstance
}

export const prisma = prismaInstance as PrismaClient

export default prisma
