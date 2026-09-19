"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Кнопка сабміту форми зі станом очікування (useActionState / useTransition). */
export function SubmitButton({
  pending,
  children,
  pendingLabel,
  icon: Icon,
  className,
}: {
  pending: boolean
  children: React.ReactNode
  pendingLabel?: React.ReactNode
  icon?: LucideIcon
  className?: string
}) {
  return (
    <Button type="submit" disabled={pending} className={className}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" /> : null}
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  )
}
