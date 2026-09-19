import { cn } from "@/lib/utils"

/** Рядок статусу для форм (успіх/помилка). */
export function FormStatus({
  state,
  className,
}: {
  state: { ok: boolean; message: string } | null
  className?: string
}) {
  if (!state) return null
  return (
    <p
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        state.ok
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30"
          : "bg-destructive/10 text-destructive",
        className
      )}
    >
      {state.message}
    </p>
  )
}
