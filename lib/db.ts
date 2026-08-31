import "server-only"

import { PrismaClient } from "@/lib/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { normalizeDatabaseUrl } from "@/lib/db/connection-string"

// Prisma 7 + @prisma/adapter-pg — рекоментований best practice для Next.js App Router та Prisma Postgres
// Singleton через globalThis щоб уникнути вичерпання з'єднань у dev (HMR)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    // Кидаємо зрозумілу помилку — вона має з'явитись у серверних логах, а не як HTML 500 для /api/auth/*
    throw new Error("DATABASE_URL is not set — перевірте .env / .env.local")
  }
  const adapter = new PrismaPg({
    connectionString: normalizeDatabaseUrl(connectionString),
  })
  return new PrismaClient({ adapter })
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}

export default prisma
