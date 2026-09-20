"use client"

import { ProgressProvider } from "@bprogress/next/app"

// Тонка смуга прогресу зверху під час навігації (App Router). Колір — primary
// (indigo, hex для сумісності з бібліотекою). shallowRouting=false — показувати
// також при зміні query (пошук/сортування/пагінація).
export function AppProgressProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ProgressProvider
      height="3px"
      color="#4f46e5"
      options={{ showSpinner: false }}
      shallowRouting={false}
    >
      {children}
    </ProgressProvider>
  )
}
