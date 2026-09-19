import { redirect } from "next/navigation"

import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { getSessionUser } from "@/lib/auth"

export const dynamic = "force-dynamic"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Двошарова перевірка (AGENTS.md: Security):
  // 1) proxy.ts робить ранній редирект на /unauthorized|/forbidden
  // 2) тут — серверна перевірка на випадок прямого рендеру / кешу / bypass
  // UI-обмеження ніколи не замінюють серверну авторизацію
  const user = await getSessionUser()

  if (!user) {
    redirect("/unauthorized")
  }
  if (user.role !== "ADMIN" || user.isActive === false) {
    redirect("/forbidden")
  }

  return (
    <div className="min-h-svh bg-muted/20">
      <SiteHeader />
      <div className="mx-auto flex max-w-[1440px] items-start">
        <AdminSidebar />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
      <SiteFooter />
    </div>
  )
}
