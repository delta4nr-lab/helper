"use client"

import * as React from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { LogIn, Menu, X, Shield } from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { AuthModal } from "@/components/auth/auth-modal"
import { UserMenu } from "@/components/auth/user-menu"
import { ThemeSwitcher } from "@/components/theme-switcher"

const nav = [
  { label: "Шаблони", href: "/templates" },
  { label: "Особовий склад", href: "/#personnel" },
  { label: "Як це працює", href: "/#how" },
]

export function SiteHeader() {
  const [open, setOpen] = React.useState(false)
  const [authOpen, setAuthOpen] = React.useState(false)
  const { data: session, status } = useSession()
  const isAuthed = status === "authenticated" && !!session?.user

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Shield className="size-4" />
              </span>
              <span className="text-[15px] font-semibold tracking-tight">
                КАНЦЕЛЯРІЯ
              </span>
              <span className="hidden rounded-full border bg-muted px-2 py-0.5 text-[10px] font-medium tracking-widest text-muted-foreground sm:inline-flex">
                BETA
              </span>
            </Link>

            <nav className="hidden items-center gap-1 lg:flex">
              {nav.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <ThemeSwitcher />
            <Separator orientation="vertical" className="mx-1 h-6" />
            {status === "loading" ? (
              <div className="h-8 w-20 animate-pulse rounded-full bg-muted" />
            ) : isAuthed ? (
              <UserMenu />
            ) : (
              <Button size="sm" onClick={() => setAuthOpen(true)}>
                <LogIn className="size-4" />
                Увійти
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1 lg:hidden">
            <ThemeSwitcher />
            {status === "loading" ? (
              <div className="size-7 animate-pulse rounded-full bg-muted" />
            ) : isAuthed ? (
              <UserMenu />
            ) : (
              <Button size="sm" onClick={() => setAuthOpen(true)}>
                <LogIn className="size-3.5" />
                Увійти
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setOpen((v) => !v)}
              aria-label="Меню"
            >
              {open ? <X className="size-4" /> : <Menu className="size-4" />}
            </Button>
          </div>
        </div>

        {open && (
          <div className="border-t bg-background lg:hidden">
            <nav className="mx-auto flex max-w-[1280px] flex-col gap-1 px-4 py-3">
              {nav.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  {item.label}
                </Link>
              ))}
              <Separator className="my-2" />
              <Link
                href="/templates"
                onClick={() => setOpen(false)}
                className={cn(buttonVariants(), "w-full")}
              >
                Створити документ
              </Link>
              {!isAuthed && status !== "loading" && (
                <Button
                  onClick={() => {
                    setOpen(false)
                    setAuthOpen(true)
                  }}
                  className="w-full"
                >
                  <LogIn className="size-4" />
                  Увійти
                </Button>
              )}
            </nav>
          </div>
        )}
      </header>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </>
  )
}
