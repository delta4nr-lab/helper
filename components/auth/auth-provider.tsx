"use client"

import * as React from "react"
import { SessionProvider, useSession } from "next-auth/react"

// Проєкція сесії для UI (site-header, user-menu). Уся робота з next-auth-хуком
// замкнена в AuthSessionBridge нижче.
export type AuthSessionUser = {
  id: string
  username: string
  role: string
  isActive: boolean
  name?: string | null
}

export type AuthSessionValue = {
  user: AuthSessionUser | null
  status: "loading" | "authenticated" | "unauthenticated"
}

// Безпечний дефолт: контекст завжди має значення, тому useAuthSession() не кидає
// навіть якщо next-auth-контекст транзієнтно недоступний (Fast Refresh/HMR,
// переходи App Router). next-auth кидає "[next-auth]: useSession must be wrapped
// in a <SessionProvider />" лише в dev — саме цей краш тут і усувається.
const AuthContext = React.createContext<AuthSessionValue>({
  user: null,
  status: "loading",
})

/** Сесія без кидків: поза провайдером повертає безпечний дефолт. */
export function useAuthSession(): AuthSessionValue {
  return React.useContext(AuthContext)
}

function AuthSessionBridge({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const value = React.useMemo<AuthSessionValue>(
    () => ({
      user: (session?.user as AuthSessionUser | undefined) ?? null,
      status,
    }),
    [session, status]
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Best practice Auth.js v5: не спамити /api/auth/session на кожен фокус вікна
  // ClientFetchError з "<!DOCTYPE" виникає коли /api/auth/session повертає HTML (500/404)
  // — головний фікс на сервері (auth.ts + route.ts runtime nodejs + lib/db.ts)
  // Тут лише зменшуємо кількість фетчів та уникаємо зайвих рефетчів
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      <AuthSessionBridge>{children}</AuthSessionBridge>
    </SessionProvider>
  )
}
