import { redirect } from "next/navigation"

import { auth } from "@/auth"

export const dynamic = "force-dynamic"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Двошарова перевірка (AGENTS.md: Security):
  // 1) middleware.ts робить ранній редирект на /unauthorized|/forbidden
  // 2) тут — серверна перевірка на випадок прямого рендеру / кешу / bypass
  // UI-обмеження ніколи не замінюють серверну авторизацію
  const session = await auth()
  const user = session?.user as unknown as { id?: string; role?: string; isActive?: boolean } | undefined

  if (!user?.id) {
    redirect("/unauthorized")
  }
  if (user.role !== "ADMIN" || user.isActive === false) {
    redirect("/forbidden")
  }

  return <>{children}</>
}
