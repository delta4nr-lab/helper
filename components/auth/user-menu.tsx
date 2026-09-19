"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { signOut } from "next-auth/react"
import { LayoutDashboard, LogOut, User2 } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useAuthSession } from "@/components/auth/auth-provider"
import { getInitials } from "@/lib/names"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function UserMenu() {
  const router = useRouter()
  const { user } = useAuthSession()
  if (!user) return null

  const username = user.username ?? user.name ?? "?"
  const role = user.role
  const initial = getInitials(username)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-8 cursor-pointer gap-2 rounded-full pr-2.5 pl-1"
          />
        }
      >
        <Avatar size="sm" className="size-7 border">
          <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
            {initial}
          </AvatarFallback>
        </Avatar>
        <span className="hidden max-w-[120px] truncate text-sm font-medium sm:inline-flex">
          {username}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="min-w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <Avatar size="sm" className="size-6">
                <AvatarFallback className="bg-muted text-xs font-semibold">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <span className="truncate font-medium">{username}</span>
            </span>
            {role && (
              <span className="text-xs font-normal text-muted-foreground">
                {role === "ADMIN" ? "Адміністратор" : "Користувач"}
              </span>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push("/profile")}>
            <User2 />
            Профіль
          </DropdownMenuItem>
          {role === "ADMIN" && (
            <DropdownMenuItem onClick={() => router.push("/admin")}>
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
