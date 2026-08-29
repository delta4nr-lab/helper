import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { UserManager } from "@/components/admin/user-manager"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function AdminUsersPage() {
  const session = await (auth as unknown as () => Promise<{ user?: { id?: string; role?: string } } | null>)()
  if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/")
  const users = await prisma.user.findMany({ select: { id: true, username: true, role: true, isActive: true, profile: { select: { lastName: true, firstName: true, rank: true } }, _count: { select: { documents: true } } }, orderBy: { createdAt: "desc" }, take: 100 })
  return <div className="min-h-svh bg-muted/20"><SiteHeader /><div className="mx-auto flex max-w-[1440px] items-start"><AdminSidebar /><main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8"><h1 className="text-2xl font-semibold tracking-tight">Користувачі</h1><p className="mt-1 text-sm text-muted-foreground">Облікові записи та доступ до системи.</p><UserManager initialUsers={users} /></main></div><SiteFooter /></div>
}
