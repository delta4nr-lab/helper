"use client"

import { AlignCenter, AlignLeft, AlignRight, RefreshCw, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ImageAlignment, SelectedImage } from "@/components/documents/types"

type Props = {
  selectedImage: SelectedImage
  keepAspect: boolean
  onKeepAspectChange: (keep: boolean) => void
  onSizeChange: (side: "width" | "height", value: number) => void
  onAlignChange: (align: ImageAlignment) => void
  onReplace: () => void
  onDelete: () => void
}

// Панель редагування обраного зображення: розміри (мм), пропорції, вирівнювання,
// заміна та видалення. Тільки UI — зміни делегує через callbacks.
export function ImageControls({
  selectedImage,
  keepAspect,
  onKeepAspectChange,
  onSizeChange,
  onAlignChange,
  onReplace,
  onDelete,
}: Props) {
  const align = (selectedImage.attrs.align as ImageAlignment) || "left"
  return (
    <div className="no-print w-60 rounded-lg border bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10">
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Ширина (мм)
          <Input
            type="number"
            min={5}
            step={1}
            value={Math.round(Number(selectedImage.attrs.widthMm) * 10) / 10}
            onChange={(e) => onSizeChange("width", Number(e.target.value))}
            className="h-7"
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Висота (мм)
          <Input
            type="number"
            min={5}
            step={1}
            value={Math.round(Number(selectedImage.attrs.heightMm) * 10) / 10}
            onChange={(e) => onSizeChange("height", Number(e.target.value))}
            className="h-7"
          />
        </label>
      </div>
      <label className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <input type="checkbox" checked={keepAspect} onChange={(e) => onKeepAspectChange(e.target.checked)} className="size-3.5 accent-primary" />
        Зберігати пропорції
      </label>
      <div className="mt-2 flex items-center gap-1">
        <Button type="button" variant={align === "left" ? "default" : "outline"} size="icon-sm" onClick={() => onAlignChange("left")} title="Вліво">
          <AlignLeft className="size-4" />
        </Button>
        <Button type="button" variant={align === "center" ? "default" : "outline"} size="icon-sm" onClick={() => onAlignChange("center")} title="По центру">
          <AlignCenter className="size-4" />
        </Button>
        <Button type="button" variant={align === "right" ? "default" : "outline"} size="icon-sm" onClick={() => onAlignChange("right")} title="Вправо">
          <AlignRight className="size-4" />
        </Button>
        <div className="flex-1" />
        <Button type="button" variant="outline" size="icon-sm" onClick={onReplace} title="Замінити">
          <RefreshCw className="size-4" />
        </Button>
        <Button type="button" variant="outline" size="icon-sm" onClick={onDelete} title="Видалити" className="text-destructive hover:text-destructive">
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}