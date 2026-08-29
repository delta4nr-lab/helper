"use client"

import { useActionState } from "react"
import { BadgeCheck, Loader2, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { updateProfileDetailsAction } from "@/app/profile/actions"

const initialState = null as unknown as { ok: boolean; message: string; field?: string } | null

export function ProfileDetailsForm({
  profile,
}: {
  profile: { lastName: string | null; firstName: string | null; middleName: string | null; rank: string | null }
}) {
  const [state, formAction, pending] = useActionState(updateProfileDetailsAction, initialState)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <BadgeCheck className="size-4 text-primary" />
          Особові дані
        </CardTitle>
        <CardDescription>ПІБ та звання — необов&apos;язкові. Використовуються для автозаповнення документів.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Прізвище</span>
              <Input name="lastName" defaultValue={profile.lastName ?? ""} placeholder="Петренко" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Ім&apos;я</span>
              <Input name="firstName" defaultValue={profile.firstName ?? ""} placeholder="Іван" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">По батькові</span>
              <Input name="middleName" defaultValue={profile.middleName ?? ""} placeholder="Васильович" />
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Звання</span>
            <Input name="rank" defaultValue={profile.rank ?? ""} placeholder="капітан, ст. лейтенант, солдат..." />
          </label>

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
