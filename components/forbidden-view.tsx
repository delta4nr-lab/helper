import Link from "next/link"
import { ShieldAlert, Lock, ArrowLeft, LogIn } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Props = {
  variant: "forbidden" | "unauthorized"
}

export function ForbiddenView({ variant }: Props) {
  const isForbidden = variant === "forbidden"
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/20 px-4 py-10">
      <Card className="w-full max-w-[480px] border-destructive/20 shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            {isForbidden ? <ShieldAlert className="size-6" /> : <Lock className="size-6" />}
          </div>
          <CardTitle className="mt-3 text-xl">
            {isForbidden ? "Доступ заборонено — 403" : "Необхідна авторизація — 401"}
          </CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            {isForbidden
              ? "Цей розділ доступний лише для адміністраторів. Ваш обліковий запис не має прав для перегляду адмін-панелі."
              : "Спочатку увійдіть у систему. Ця сторінка доступна лише авторизованим користувачам."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="rounded-lg bg-muted px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            {isForbidden ? (
              <>
                Якщо вам потрібен доступ — зверніться до адміністратора системи.
                <br />
                Спроба відкрити <span className="font-mono font-medium text-foreground">/admin</span> без ролі{" "}
                <span className="font-medium text-foreground">ADMIN</span> блокується на сервері (middleware + layout).
              </>
            ) : (
              <>
                Натисніть «Увійти» на головній сторінці та введіть логін і пароль.
                <br />
                Після входу вас автоматично поверне до захищеного розділу.
              </>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "w-full sm:w-auto")}>
              <ArrowLeft className="size-4" />
              На головну
            </Link>
            <Link href="/" className={cn(buttonVariants(), "w-full sm:w-auto")}>
              <LogIn className="size-4" />
              Увійти
            </Link>
          </div>
          <p className="text-center text-[11px] text-muted-foreground">Код помилки: {isForbidden ? "FORBIDDEN_403" : "UNAUTHORIZED_401"}</p>
        </CardContent>
      </Card>
    </div>
  )
}
