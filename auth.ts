import NextAuth, { type DefaultSession } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcrypt"

// Fail fast з зрозумілим повідомленням в логах, замість HTML 500 на /api/auth/*
if (!process.env.AUTH_SECRET) {
  // В production NextAuth кине свою помилку, але тут даємо чіткий текст для логів
  console.warn("[auth] AUTH_SECRET is not set — sessions will not work. Згенеруй: npx auth secret")
}

// Розширення типів для сесії / JWT — зберігаємо username, role, isActive
declare module "next-auth" {
  interface User {
    username: string
    role: "ADMIN" | "USER"
    isActive: boolean
  }
  interface Session {
    user: {
      id: string
      username: string
      role: "ADMIN" | "USER"
      isActive: boolean
    } & DefaultSession["user"]
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string
    username?: string
    role?: "ADMIN" | "USER"
    isActive?: boolean
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Auth.js v5 best practice: явний secret + trustHost для проксі/Vercel
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  // Використовуємо модалку на "/" замість окремої сторінки логіну — не редіректимо
  pages: {
    signIn: "/",
  },
  providers: [
    Credentials({
      id: "credentials",
      name: "Логін та пароль",
      credentials: {
        username: { label: "Логін", type: "text", placeholder: "admin" },
        password: { label: "Пароль", type: "password" },
      },
      authorize: async (credentials) => {
        const rawUsername = credentials?.username
        const rawPassword = credentials?.password
        if (typeof rawUsername !== "string" || typeof rawPassword !== "string") return null

        const username = rawUsername.trim().toLowerCase()
        const password = rawPassword
        if (!username || !password) return null
        if (username.length < 3 || username.length > 32) return null

        try {
          // Динамічний імпорт щоб не тягнути Prisma (node:path, node:url) в Edge Runtime (middleware/proxy)
          // authorize виконується тільки в Node.js (route handler), але топ-рівневий import зламає Edge бандл
          const { db } = await import("@/lib/db")
          const user = await db.orm.public.User.first({ username })
          if (!user) return null
          if (!user.isActive) return null

          const ok = await bcrypt.compare(password, user.password)
          if (!ok) return null

          return {
            id: user.id,
            name: user.username,
            email: `${user.username}@local`,
            username: user.username,
            role: user.role as "ADMIN" | "USER",
            isActive: user.isActive,
          }
        } catch (error) {
          // Критично: не прокидати помилку БД як 500 HTML на /api/auth/callback/credentials
          // Auth.js перетворить throw у 500 з HTML, що викликає ClientFetchError з "<!DOCTYPE"
          // Замість цього логуємо на сервері та повертаємо null -> клієнт отримає "CredentialsSignin"
          console.error("[auth][authorize] DB error:", error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    // Для middleware (`auth` як middleware) — вирішує чи дозволений запит
    authorized({ auth: session, request: { nextUrl } }) {
      const pathname = nextUrl.pathname
      // Захист /admin — тільки ADMIN, /profile — будь-який авторизований
      if (pathname.startsWith("/admin")) {
        const role = (session?.user as unknown as { role?: string })?.role
        const isActive = (session?.user as unknown as { isActive?: boolean })?.isActive ?? true
        return !!session?.user && role === "ADMIN" && isActive !== false
      }
      if (pathname.startsWith("/profile")) {
        return !!session?.user
      }
      return true
    },
    jwt({ token, user }) {
      if (user) {
        // user приходить тільки на логіні — типізуємо без as unknown
        const u = user as unknown as { id: string; username: string; role: "ADMIN" | "USER"; isActive: boolean }
        token.id = u.id ?? token.sub
        token.username = u.username
        token.role = u.role
        token.isActive = u.isActive
        token.name = u.username
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? (token.sub as string) ?? ""
        session.user.username = (token.username as string) ?? (token.name as string) ?? ""
        session.user.role = (token.role as "ADMIN" | "USER") ?? "USER"
        session.user.isActive = (token.isActive as boolean) ?? true
        session.user.name = (token.username as string) ?? session.user.name
      }
      return session
    },
  },
})
