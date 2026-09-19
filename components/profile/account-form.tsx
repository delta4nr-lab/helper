"use client"

import * as React from "react"
import { useActionState } from "react"
import { Save, User } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { FormStatus } from "@/components/shared/form-status"
import { SubmitButton } from "@/components/shared/submit-button"
import { updateAccountAction, type ActionResult } from "@/app/profile/actions"

const initialState: ActionResult | null = null

export function AccountForm({ username }: { username: string }) {
  const [state, formAction, pending] = useActionState(
    updateAccountAction,
    initialState
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <User className="size-4 text-primary" />
          Обліковий запис
        </CardTitle>
        <CardDescription>
          Змініть логін та/або пароль. Логін — латиниця, цифри, _ (3–20). Пароль
          — мін. 8 символів.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Логін *</span>
            <Input
              name="username"
              defaultValue={username}
              placeholder="ваш_логін"
              required
              minLength={3}
              maxLength={20}
            />
            {state?.field === "username" && !state.ok && (
              <span className="text-xs text-destructive">{state.message}</span>
            )}
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Новий пароль</span>
              <Input
                name="newPassword"
                type="password"
                placeholder="залиште порожнім — без зміни"
                autoComplete="new-password"
              />
              {state?.field === "newPassword" && !state.ok && (
                <span className="text-xs text-destructive">
                  {state.message}
                </span>
              )}
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Підтвердження паролю</span>
              <Input
                name="confirmPassword"
                type="password"
                placeholder="повторіть пароль"
                autoComplete="new-password"
              />
              {state?.field === "confirmPassword" && !state.ok && (
                <span className="text-xs text-destructive">
                  {state.message}
                </span>
              )}
            </label>
          </div>

          <FormStatus state={state} />

          <div className="flex justify-end">
            <SubmitButton pending={pending} icon={Save}>
              Зберегти
            </SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
