"use client"

import * as React from "react"
import { signOut, useSession } from "next-auth/react"
import { LayoutDashboard, LogOut, User2 } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function avatarFallback(username: string): string {
  return username.trim().charAt(0).toUpperCase() || "?"
}

export function UserMenu() {
  const { data: session } = useSession()
  const user = session?.user
  if (!user) return null

  const username = (user as unknown as { username: string }).username ?? user.name ?? "?"
  const role = (user as unknown as { role: string }).role
  const initial = avatarFallback(username)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-8 cursor-pointer gap-2 rounded-full pl-1 pr-2.5"
          />
        }
      >
        <Avatar size="sm" className="size-7 border">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
            {initial}
          </AvatarFallback>
        </Avatar>
        <span className="hidden max-w-[120px] truncate text-sm font-medium sm:inline-flex">{username}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <Avatar size="sm" className="size-6">
                <AvatarFallback className="bg-muted text-xs font-semibold">{initial}</AvatarFallback>
              </Avatar>
              <span className="truncate font-medium">{username}</span>
            </span>
            {role && <span className="text-xs font-normal text-muted-foreground">{role === "ADMIN" ? "Адміністратор" : "Користувач"}</span>}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => (window.location.href = "/profile")}>
            <User2 />
            Профіль
          </DropdownMenuItem>
          {role === "ADMIN" && (
            <DropdownMenuItem onClick={() => (window.location.href = "/admin")}>
              <LayoutDashboard />
              Адмін панель
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOut />
            Вийти
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
