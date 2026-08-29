"use client"

import * as React from "react"
import { useActionState } from "react"
import { Loader2, Save, User } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { updateAccountAction } from "@/app/profile/actions"

const initialState = null as unknown as { ok: boolean; message: string; field?: string } | null

export function AccountForm({ username }: { username: string }) {
  const [state, formAction, pending] = useActionState(updateAccountAction, initialState)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <User className="size-4 text-primary" />
          Обліковий запис
        </CardTitle>
        <CardDescription>Змініть логін та/або пароль. Логін — латиниця, цифри, _ (3–20). Пароль — мін. 8 символів.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Логін *</span>
            <Input name="username" defaultValue={username} placeholder="ваш_логін" required minLength={3} maxLength={20} />
            {state?.field === "username" && !state.ok && (
              <span className="text-xs text-destructive">{state.message}</span>
            )}
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Новий пароль</span>
              <Input name="newPassword" type="password" placeholder="залиште порожнім — без зміни" autoComplete="new-password" />
              {state?.field === "newPassword" && !state.ok && (
                <span className="text-xs text-destructive">{state.message}</span>
              )}
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Підтвердження паролю</span>
              <Input name="confirmPassword" type="password" placeholder="повторіть пароль" autoComplete="new-password" />
              {state?.field === "confirmPassword" && !state.ok && (
                <span className="text-xs text-destructive">{state.message}</span>
              )}
            </label>
          </div>

          {state && (
            <p className={`rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30" : "bg-destructive/10 text-destructive"}`}>
              {state.message}
            </p>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Зберегти
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
