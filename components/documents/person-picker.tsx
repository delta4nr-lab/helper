"use client"

import * as React from "react"
import { Popover } from "@base-ui/react/popover"
import { Check, ChevronDown, Loader2, Search } from "lucide-react"

import { cn } from "@/lib/utils"

export type PersonPickerItem = {
  id: string
  name: string
  position: string
  rank: string
}

type PersonPickerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  icon?: React.ReactNode
  triggerLabel: string
  items: PersonPickerItem[]
  selectedId?: string | null
  loading?: boolean
  onSelect: (personId: string) => void
  onClear?: () => void
  onClearSignature?: () => void
  showClearSignature?: boolean
  /** Компактний тригер: кругла кнопка-іконка без тексту і шеврона. */
  compact?: boolean
}

// Внутрішній контент попапа: монтується разом із Popup,
// тому стан пошуку скидається на кожне відкриття без ефектів.
function PersonPickerPopupContent({
  items,
  selectedId,
  loading = false,
  onSelect,
  onClear,
  onClearSignature,
  showClearSignature = false,
}: Omit<PersonPickerProps, "open" | "onOpenChange" | "title" | "icon" | "triggerLabel">) {
  const [query, setQuery] = React.useState("")
  const [activeIndex, setActiveIndex] = React.useState(0)
  const listRef = React.useRef<HTMLDivElement>(null)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      const hay = `${item.name} ${item.position} ${item.rank}`.toLowerCase()
      return hay.includes(q)
    })
  }, [query, items])

  // Скрол до активного елемента
  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
    el?.scrollIntoView({ block: "nearest" })
  }, [activeIndex, filtered.length])

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      if (filtered.length > 0) setActiveIndex((i) => (i + 1) % filtered.length)
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      if (filtered.length > 0) setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length)
    } else if (event.key === "Enter") {
      event.preventDefault()
      const item = filtered[activeIndex]
      if (item) onSelect(item.id)
    }
  }

  const showFooter = showClearSignature || Boolean(onClear)

  return (
    <>
      <div className="border-b p-1.5">
        <div className="flex items-center gap-2 rounded-md border border-input bg-transparent px-2.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Пошук за ПІБ..."
            className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      </div>

      <div ref={listRef} className="max-h-60 overflow-y-auto p-1">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Завантаження...
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">Нічого не знайдено</div>
        ) : (
          filtered.map((item, index) => {
            const active = index === activeIndex
            const selected = item.id === selectedId
            return (
              <button
                key={item.id}
                type="button"
                data-index={index}
                title={item.name}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm outline-none select-none cursor-pointer hover:bg-accent hover:text-accent-foreground",
                  active && "bg-accent text-accent-foreground"
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{item.name}</span>
                  {(item.position || item.rank) && (
                    <span className="truncate text-xs text-muted-foreground">
                      {[item.position, item.rank].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
                {selected && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            )
          })
        )}
      </div>

      {showFooter && (
        <>
          <div className="h-px bg-border" />
          <div className="p-1">
            {showClearSignature && (
              <button
                type="button"
                onClick={onClearSignature}
                className="flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-left text-sm text-destructive outline-none select-none hover:bg-destructive/10 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Видалити підпис
              </button>
            )}
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                className="flex w-full cursor-pointer items-center rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground outline-none select-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Очистити (зняти особу)
              </button>
            )}
          </div>
        </>
      )}
    </>
  )
}

export function PersonPicker({
  open,
  onOpenChange,
  title,
  icon,
  triggerLabel,
  items,
  selectedId,
  loading,
  onSelect,
  onClear,
  onClearSignature,
  showClearSignature,
  compact = false,
}: PersonPickerProps) {
  return (
    <Popover.Root open={open} onOpenChange={(next) => onOpenChange(next)} modal={false}>
      <Popover.Trigger
        type="button"
        title={title}
        aria-label={title}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-input bg-background text-sm font-medium text-foreground shadow-xs outline-none transition-colors cursor-pointer hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-accent data-popup-open:text-accent-foreground",
          compact
            ? "size-7 justify-center rounded-md bg-background text-muted-foreground shadow-sm border-border hover:bg-accent hover:text-foreground active:scale-95 data-popup-open:bg-accent data-popup-open:text-foreground animate-in fade-in-0 zoom-in-95 duration-150"
            : "h-9 max-w-56 px-2.5",
        )}
      >
        {icon}
        {!compact && (
          <>
            <span className="max-w-36 truncate">{triggerLabel}</span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform data-popup-open:rotate-180" />
          </>
        )}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner align="start" side="bottom" sideOffset={10}>
          <Popover.Popup className="isolate z-50 w-[min(17rem,calc(100vw-2rem))] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <PersonPickerPopupContent
              items={items}
              selectedId={selectedId}
              loading={loading}
              onSelect={onSelect}
              onClear={onClear}
              onClearSignature={onClearSignature}
              showClearSignature={showClearSignature}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}