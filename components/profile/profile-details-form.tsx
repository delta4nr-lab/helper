"use client"

import { useActionState } from "react"
import { BadgeCheck, Save } from "lucide-react"

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
import {
  updateProfileDetailsAction,
  type ActionResult,
} from "@/app/profile/actions"

const initialState: ActionResult | null = null

export function ProfileDetailsForm({
  profile,
}: {
  profile: {
    lastName: string | null
    firstName: string | null
    middleName: string | null
    rank: string | null
  }
}) {
  const [state, formAction, pending] = useActionState(
    updateProfileDetailsAction,
    initialState
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <BadgeCheck className="size-4 text-primary" />
          Особові дані
        </CardTitle>
        <CardDescription>
          ПІБ та звання — необов&apos;язкові. Використовуються для
          автозаповнення документів.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Прізвище</span>
              <Input
                name="lastName"
                defaultValue={profile.lastName ?? ""}
                placeholder="Петренко"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Ім&apos;я</span>
              <Input
                name="firstName"
                defaultValue={profile.firstName ?? ""}
                placeholder="Іван"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">По батькові</span>
              <Input
                name="middleName"
                defaultValue={profile.middleName ?? ""}
                placeholder="Васильович"
              />
            </label>
          </div>

          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Звання</span>
            <Input
              name="rank"
              defaultValue={profile.rank ?? ""}
              placeholder="капітан, ст. лейтенант, солдат..."
            />
          </label>

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
