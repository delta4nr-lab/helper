"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { PageSettings } from "@/lib/documents/page"

type PageSettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  page: PageSettings
  onApply: (page: PageSettings) => void
  onReset?: () => void
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value * 10) / 10))
}

// Форма налаштувань. Рендериться всередині DialogContent, який монтується
// при відкритті — стан draft скидається автоматично (без setState в ефекті).
function PageSettingsForm({
  page,
  onApply,
  onReset,
}: {
  page: PageSettings
  onApply: (page: PageSettings) => void
  onReset?: () => void
}) {
  const [draft, setDraft] = React.useState<PageSettings>(page)

  function setMargin(side: keyof PageSettings["margins"], raw: string) {
    setDraft((prev) => ({ ...prev, margins: { ...prev.margins, [side]: clampNumber(Number(raw), 0, 50) } }))
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Налаштування сторінки</DialogTitle>
      </DialogHeader>

      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Формат</Label>
            <Select value={draft.size} onValueChange={(value) => setDraft((prev) => ({ ...prev, size: value as PageSettings["size"] }))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A4">A4 (210 × 297 мм)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Орієнтація</Label>
            <Select
              value={draft.orientation}
              onValueChange={(value) => setDraft((prev) => ({ ...prev, orientation: value as PageSettings["orientation"] }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">Книжкова</SelectItem>
                <SelectItem value="landscape">Альбомна</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2">
          <Label>Поля</Label>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["top", "Верхнє"],
                ["right", "Праве"],
                ["bottom", "Нижнє"],
                ["left", "Ліве"],
              ] as const
            ).map(([side, label]) => (
              <div key={side} className="grid gap-1">
                <Label htmlFor={`page-margin-${side}`} className="text-xs text-muted-foreground">
                  {label}
                </Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    id={`page-margin-${side}`}
                    type="number"
                    min={0}
                    max={50}
                    step={0.5}
                    value={draft.margins[side]}
                    onChange={(event) => setMargin(side, event.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">мм</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => { onReset?.(); onApply({ ...page }) }}>
          Скинути
        </Button>
        <Button type="button" onClick={() => onApply(draft)}>
          Застосувати
        </Button>
      </DialogFooter>
    </>
  )
}

export function PageSettingsDialog({ open, onOpenChange, page, onApply, onReset }: PageSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <PageSettingsForm page={page} onApply={(next) => { onApply(next); onOpenChange(false) }} onReset={onReset} />
      </DialogContent>
    </Dialog>
  )
}