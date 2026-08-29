"use client"

import * as React from "react"
import { signIn } from "next-auth/react"
import { LogIn, Eye, EyeOff, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function AuthModal({ open, onOpenChange }: Props) {
  const [username, setUsername] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [show, setShow] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)



  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const u = username.trim().toLowerCase()
    if (u.length < 3) {
      setError("Введіть коректний логін (мін. 3 символи)")
      return
    }
    if (password.length < 3) {
      setError("Введіть пароль")
      return
    }

    setPending(true)
    try {
      const res = await signIn("credentials", {
        username: u,
        password,
        redirect: false,
      })

      if (res?.error) {
        setError("Невірний логін або пароль")
        return
      }
      if (res?.ok) {
        onOpenChange(false)
        setPassword("")
        // onOpenChange handles close; session оновиться автоматично
      } else {
        setError("Не вдалося увійти. Спробуйте ще раз.")
      }
    } catch {
      setError("Помилка з'єднання. Спробуйте ще раз.")
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px] gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <LogIn className="size-3.5" />
            </span>
            Вхід до канцелярії
          </DialogTitle>
          <DialogDescription>Введіть логін та пароль вашого облікового запису</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-6">
          <div className="grid gap-3">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Логін</span>
              <Input
                autoFocus
                autoComplete="username"
                placeholder="напр. admin"
                value={username}
                onChange={(e) => {
                  if (error) setError(null)
                  setUsername(e.target.value)
                }}
                disabled={pending}
                className="h-9"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Пароль</span>
              <div className="relative">
                <Input
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    if (error) setError(null)
                    setPassword(e.target.value)
                  }}
                  disabled={pending}
                  className="h-9 pr-9"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 size-7"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Сховати пароль" : "Показати пароль"}
                  tabIndex={-1}
                >
                  {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </Button>
              </div>
            </label>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Вхід...
              </>
            ) : (
              <>
                <LogIn className="size-4" />
                Увійти
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Демо: <span className="font-medium text-foreground">admin / Admin123!</span> або{" "}
            <span className="font-medium text-foreground">user / User123!</span>
          </p>
        </form>
      </DialogContent>
    </Dialog>
  )
}
