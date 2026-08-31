"use client"

import * as React from "react"
import { SessionProvider } from "next-auth/react"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Best practice Auth.js v5: не спамити /api/auth/session на кожен фокус вікна
  // ClientFetchError з "<!DOCTYPE" виникає коли /api/auth/session повертає HTML (500/404)
  // — головний фікс на сервері (auth.ts + route.ts runtime nodejs + lib/db.ts)
  // Тут лише зменшуємо кількість фетчів та уникаємо зайвих рефетчів
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      {children}
    </SessionProvider>
  )
}
