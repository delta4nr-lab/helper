import Link from "next/link"
import { Folder, LayoutDashboard, Settings, Shield, Users, UsersRound } from "lucide-react"

export function AdminSidebar() {
  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 border-r bg-background p-4 lg:block">
      <div className="mb-6 flex items-center gap-2 px-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Shield className="size-4" />
        </span>
        <div>
          <div className="text-sm font-semibold">Адмін-панель</div>
          <div className="text-xs text-muted-foreground">Канцелярія</div>
        </div>
      </div>
      <nav className="grid gap-1 text-sm">
        <Link
          href="/admin"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LayoutDashboard className="size-4" />
          Огляд
        </Link>
        <Link
          href="/admin/users"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Users className="size-4" />
          Користувачі
        </Link>
        <Link
          href="/admin/personnel"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <UsersRound className="size-4" />
          Штат
        </Link>
        <Link
          href="/admin/categories"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Folder className="size-4" />
          Категорії
        </Link>
        <Link
          href="/profile"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Settings className="size-4" />
          Профіль
        </Link>
      </nav>
    </aside>
  )
}
