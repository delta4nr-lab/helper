import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { UserManager } from "@/components/admin/user-manager"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { orm } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function AdminUsersPage() {
  const users = await orm.User.select("id", "username", "role", "isActive")
    .include("profile", (p) => p.select("lastName", "firstName", "rank"))
    .orderBy((u) => u.createdAt.desc())
    .limit(100)
    .all()
  return <div className="min-h-svh bg-muted/20"><SiteHeader /><div className="mx-auto flex max-w-[1440px] items-start"><AdminSidebar /><main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8"><h1 className="text-2xl font-semibold tracking-tight">Користувачі</h1><p className="mt-1 text-sm text-muted-foreground">Облікові записи та доступ до системи.</p><UserManager initialUsers={users} /></main></div><SiteFooter /></div>
}
