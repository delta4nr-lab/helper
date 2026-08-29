"use client"

import * as React from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Props = {
  placeholder?: string
  total: number
  filtered: number
  onQueryChange: (q: string) => void
}

export function TemplatesFilter({ placeholder, total, filtered, onQueryChange }: Props) {
  const [q, setQ] = React.useState("")

  const handleChange = (value: string) => {
    setQ(value)
    onQueryChange(value)
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder ?? "Пошук за назвою, кодом, тегами..."}
          className="h-9 pl-9 pr-9"
        />
        {q && (
          <Button
            variant="ghost"
            size="icon-xs"
            className="absolute right-1 top-1/2 -translate-y-1/2"
            onClick={() => handleChange("")}
            aria-label="Очистити"
          >
            <X className="size-3.5" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="rounded-full">
          Показано {filtered} з {total}
        </Badge>
        {filtered !== total && <span>· фільтр активний</span>}
      </div>
    </div>
  )
}
