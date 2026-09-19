import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Спільний порожній стан списку (немає даних або нічого не знайдено). */
export function EmptyState({
  icon: Icon,
  iconClassName = "bg-primary/10 text-primary",
  title,
  description,
  action,
}: {
  icon: LucideIcon
  iconClassName?: string
  title: string
  description: React.ReactNode
  action?: { href: string; label: string; variant?: "default" | "outline" }
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-card px-6 py-16 text-center">
      <span
        className={cn(
          "flex size-12 items-center justify-center rounded-2xl",
          iconClassName
        )}
      >
        <Icon className="size-6" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-[42ch] text-sm text-muted-foreground">{description}</p>
      </div>
      {action && (
        <Link
          href={action.href}
          className={cn(buttonVariants({ variant: action.variant ?? "outline", size: "sm" }))}
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}
