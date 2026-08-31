import { handlers } from "@/auth"

// Auth.js + bcrypt + Prisma вимагають Node.js runtime — edge не підтримує bcrypt
export const runtime = "nodejs"

export const { GET, POST } = handlers
