import NextAuth, { type DefaultSession } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcrypt"

import { prisma } from "@/lib/db"

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
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
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

        const user = await prisma.user.findUnique({ where: { username } })
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
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = (user as unknown as { id: string }).id ?? token.sub
        token.username = (user as unknown as { username: string }).username
        token.role = (user as unknown as { role: "ADMIN" | "USER" }).role
        token.isActive = (user as unknown as { isActive: boolean }).isActive
        token.name = (user as unknown as { username: string }).username
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? (token.sub as string)
        session.user.username = (token.username as string) ?? (token.name as string) ?? ""
        session.user.role = (token.role as "ADMIN" | "USER") ?? "USER"
        session.user.isActive = (token.isActive as boolean) ?? true
        session.user.name = (token.username as string) ?? session.user.name
      }
      return session
    },
  },
})
