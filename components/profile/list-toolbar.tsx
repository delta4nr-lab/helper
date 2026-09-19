"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ListQuery, SortOption } from "@/components/profile/types"
import { buildProfileHref } from "@/lib/profile/query"

export function ListToolbar({
  tab,
  q,
  sort,
  sortOptions,
  placeholder,
}: {
  tab: ListQuery["tab"]
  q: string
  sort: string
  sortOptions: SortOption[]
  placeholder?: string
}) {
  const router = useRouter()
  const [value, setValue] = React.useState(q)
  const [lastQ, setLastQ] = React.useState(q)

  // Зовнішня навігація (напр. «Очистити пошук») змінює q — синхронізуємо поле,
  // інакше дебаунс-ефект повернув би старий запит у URL.
  if (q !== lastQ) {
    setLastQ(q)
    setValue(q)
  }

  const initialQ = q
  React.useEffect(() => {
    if (value.trim() === initialQ.trim()) return
    const timer = setTimeout(() => {
      router.replace(buildProfileHref({ tab, q: value.trim(), sort }, 1))
    }, 350)
    return () => clearTimeout(timer)
  }, [value, initialQ, sort, tab, router])

  function changeSort(next: string | null) {
    router.replace(
      buildProfileHref({ tab, q: value.trim(), sort: next ?? "" }, 1)
    )
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder ?? "Пошук..."}
          className="h-10 rounded-xl pr-9 pl-9"
          autoComplete="off"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="absolute top-1/2 right-1.5 -translate-y-1/2"
            aria-label="Очистити пошук"
            onClick={() => setValue("")}
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>

      <Select
        items={sortOptions}
        value={sort}
        onValueChange={(next) => changeSort(next as string | null)}
      >
        <SelectTrigger size="sm" className="h-10! rounded-xl sm:w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
