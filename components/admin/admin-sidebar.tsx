"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  FileText,
  Folder,
  GraduationCap,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  Users,
  UsersRound,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const NAV_ITEMS = [
  { href: "/admin", label: "Огляд", icon: LayoutDashboard },
  { href: "/admin/users", label: "Користувачі", icon: Users },
  { href: "/admin/personnel", label: "Особовий склад", icon: UsersRound },
  { href: "/admin/courses", label: "Курси", icon: GraduationCap },
  { href: "/admin/templates", label: "Шаблони", icon: FileText },
  { href: "/admin/categories", label: "Категорії", icon: Folder },
  { href: "/profile", label: "Профіль", icon: Settings },
] as const

const EDITOR_ROUTE = /^\/admin\/templates\/[^/]+$/

export function AdminSidebar() {
  const pathname = usePathname()
  const isEditorRoute = EDITOR_ROUTE.test(pathname)
  const [override, setOverride] = useState<{
    pathname: string
    collapsed: boolean
  } | null>(null)

  const collapsed =
    override?.pathname === pathname ? override.collapsed : isEditorRoute

  return (
    <TooltipProvider delay={200}>
      <aside
        className={cn(
          "sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 border-r bg-background transition-[width] duration-200 lg:block",
          collapsed ? "w-14 p-2" : "w-60 p-4"
        )}
      >
        <div
          className={cn(
            "mb-6 flex gap-2",
            collapsed
              ? "flex-col items-center"
              : "items-center justify-between px-2"
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Shield className="size-4" />
            </span>
            {!collapsed && (
              <div className="min-w-0">
                <div className="text-sm font-semibold">Адмін-панель</div>
                <div className="text-xs text-muted-foreground">Канцелярія</div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOverride({ pathname, collapsed: !collapsed })}
            aria-label={
              collapsed ? "Розгорнути бічну панель" : "Згорнути бічну панель"
            }
            title={collapsed ? "Розгорнути" : "Згорнути"}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
        </div>
        <nav className="grid gap-1 text-sm">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Tooltip key={href}>
              <TooltipTrigger
                disabled={!collapsed}
                aria-label={label}
                render={<Link href={href} />}
                className={cn(
                  "flex items-center gap-2 rounded-lg py-2 text-muted-foreground hover:bg-muted hover:text-foreground",
                  collapsed ? "justify-center" : "px-3"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          ))}
        </nav>
      </aside>
    </TooltipProvider>
  )
}
