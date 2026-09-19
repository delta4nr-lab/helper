import { UserManager } from "@/components/admin/user-manager"
import { orm } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function AdminUsersPage() {
  const users = await orm.User.select("id", "username", "role", "isActive")
    .include("profile", (p) => p.select("lastName", "firstName", "rank"))
    .orderBy((u) => u.createdAt.desc())
    .limit(100)
    .all()

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Користувачі</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Облікові записи та доступ до системи.
      </p>
      <UserManager initialUsers={users} />
    </>
  )
}
