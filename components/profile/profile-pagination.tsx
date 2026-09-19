import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ListQuery } from "@/components/profile/types"

function buildHref(page: number, query: ListQuery): string {
  const params = new URLSearchParams({ tab: query.tab, page: String(page) })
  if (query.q) params.set("q", query.q)
  if (query.sort) params.set("sort", query.sort)
  return `/profile?${params.toString()}`
}

// Компактний ряд сторінок: 1 … N-1 N N+1 … last
function pageWindow(page: number, totalPages: number): (number | "ellipsis")[] {
  const wanted = new Set<number>([1, totalPages, page - 1, page, page + 1])
  const sorted = [...wanted]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b)

  const result: (number | "ellipsis")[] = []
  let previous = 0
  for (const p of sorted) {
    if (previous && p - previous > 1) result.push("ellipsis")
    result.push(p)
    previous = p
  }
  return result
}

export function ProfilePagination({
  query,
  totalPages,
}: {
  query: ListQuery
  totalPages: number
}) {
  if (totalPages <= 1) return null
  const pages = pageWindow(query.page, totalPages)

  const navClass = (disabled: boolean, extra?: string) =>
    cn(
      buttonVariants({ variant: "outline", size: "sm" }),
      "h-8 min-w-8 justify-center px-2",
      disabled && "pointer-events-none opacity-50",
      extra
    )

  return (
    <nav
      aria-label="Пагінація"
      className="flex flex-wrap items-center justify-center gap-1.5 pt-2"
    >
      <Link
        href={buildHref(Math.max(1, query.page - 1), query)}
        aria-disabled={query.page <= 1}
        tabIndex={query.page <= 1 ? -1 : undefined}
        className={navClass(query.page <= 1)}
      >
        <ChevronLeft className="size-4" />
      </Link>

      {pages.map((item, index) =>
        item === "ellipsis" ? (
          <span
            key={`ellipsis-${index}`}
            className="px-1 text-sm text-muted-foreground"
          >
            …
          </span>
        ) : (
          <Link
            key={item}
            href={buildHref(item, query)}
            aria-current={item === query.page ? "page" : undefined}
            className={cn(
              buttonVariants({
                variant: item === query.page ? "default" : "outline",
                size: "sm",
              }),
              "h-8 min-w-8 justify-center px-2"
            )}
          >
            {item}
          </Link>
        )
      )}

      <Link
        href={buildHref(Math.min(totalPages, query.page + 1), query)}
        aria-disabled={query.page >= totalPages}
        tabIndex={query.page >= totalPages ? -1 : undefined}
        className={navClass(query.page >= totalPages)}
      >
        <ChevronRight className="size-4" />
      </Link>
    </nav>
  )
}
