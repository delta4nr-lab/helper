"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Loader2, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type SearchItem = {
  id: string
  categorySlug: string
  title: string
  description: string
  categoryTitle: string | null
}

type SearchState = {
  query: string
  items: SearchItem[]
  total: number
  loading: boolean
}

const MIN_QUERY = 2
const SUGGEST_LIMIT = 8
const DEBOUNCE_MS = 250

export function HomeSearch({
  placeholder = "Пошук: рапорт на відпустку, наказ, довідка...",
}: {
  placeholder?: string
}) {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [state, setState] = React.useState<SearchState>({
    query: "",
    items: [],
    total: 0,
    loading: false,
  })
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const trimmed = query.trim()
  const enabled = trimmed.length >= MIN_QUERY

  // Результати показуємо лише тоді, коли вони відповідають поточному запиту.
  const isCurrent = state.query === trimmed
  const items = isCurrent ? state.items : []
  const total = isCurrent ? state.total : 0
  const loading = enabled && (!isCurrent || state.loading)

  React.useEffect(() => {
    if (!enabled) return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setState((prev) => ({ ...prev, loading: true }))
      try {
        const res = await fetch(
          `/api/templates/search?q=${encodeURIComponent(trimmed)}&limit=${SUGGEST_LIMIT}`,
          { signal: controller.signal }
        )
        if (!res.ok) throw new Error("request failed")
        const data = (await res.json()) as { items: SearchItem[]; total: number }
        setState({
          query: trimmed,
          items: data.items,
          total: data.total,
          loading: false,
        })
        setActiveIndex(-1)
        setOpen(true)
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setState({ query: trimmed, items: [], total: 0, loading: false })
          setOpen(true)
        }
      }
    }, DEBOUNCE_MS)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [enabled, trimmed])

  React.useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [])

  const goToResults = React.useCallback(
    (value: string) => {
      const q = value.trim()
      if (!q) return
      setOpen(false)
      router.push(`/search?q=${encodeURIComponent(q)}`)
    },
    [router]
  )

  function openTemplate(item: SearchItem) {
    setOpen(false)
    router.push(`/templates/${item.categorySlug}/${item.id}`)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      if (items.length === 0) return
      event.preventDefault()
      setOpen(true)
      setActiveIndex((i) => (i + 1) % items.length)
    } else if (event.key === "ArrowUp") {
      if (items.length === 0) return
      event.preventDefault()
      setActiveIndex((i) => (i - 1 + items.length) % items.length)
    } else if (event.key === "Enter") {
      event.preventDefault()
      const active = open ? items[activeIndex] : undefined
      if (active) openTemplate(active)
      else goToResults(query)
    } else if (event.key === "Escape") {
      setOpen(false)
    }
  }

  const showDropdown = open && enabled

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-2 rounded-xl border bg-card p-1.5 shadow-sm">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => {
              if (enabled) setOpen(true)
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoComplete="off"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls="home-search-results"
            aria-autocomplete="list"
            className="h-9 border-0 bg-transparent pl-9 shadow-none focus-visible:ring-0"
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0"
          disabled={trimmed.length === 0}
          onClick={() => goToResults(query)}
        >
          Знайти шаблон
          <ArrowRight className="size-4" />
        </Button>
      </div>

      {showDropdown && (
        <div
          id="home-search-results"
          role="listbox"
          className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Пошук…
            </div>
          ) : items.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">
              Нічого не знайдено за запитом «{trimmed}».
            </div>
          ) : (
            <>
              <ul className="max-h-80 overflow-y-auto">
                {items.map((item, index) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => openTemplate(item)}
                      className={cn(
                        "flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-colors",
                        index === activeIndex
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {item.title}
                        </span>
                        {item.categoryTitle && (
                          <Badge
                            variant="outline"
                            className="shrink-0 rounded-full text-[10px]"
                          >
                            {item.categoryTitle}
                          </Badge>
                        )}
                      </span>
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => goToResults(query)}
                className="mt-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                <span>Всі результати ({total})</span>
                <ArrowRight className="size-3.5" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
