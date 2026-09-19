import { NextResponse } from "next/server"

import { searchTemplates } from "@/lib/db/templates"

// Публічний пошук шаблонів по всьому каталогу (усі категорії).
// Використовується живими підказками на головній сторінці.
export async function GET(request: Request) {
  const url = new URL(request.url)
  const q = url.searchParams.get("q")?.trim() ?? ""
  const limitParam = Number(url.searchParams.get("limit") ?? "8")
  const limit = Number.isFinite(limitParam)
    ? Math.min(20, Math.max(1, Math.floor(limitParam)))
    : 8

  if (!q) {
    return NextResponse.json({ items: [], total: 0, q })
  }

  try {
    const { items, total } = await searchTemplates({ q, limit })
    return NextResponse.json({ items, total, q })
  } catch (error) {
    console.warn("[api/templates/search] помилка пошуку", error)
    return NextResponse.json({ items: [], total: 0, q })
  }
}
