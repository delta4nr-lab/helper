import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { orm } from "@/lib/db"

type Params = { id: string }

export async function GET(request: Request, { params }: { params: Promise<Params> }) {
  const session = await (auth as unknown as () => Promise<{ user?: { id?: string; role?: string } } | null>)()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ message: "Не авторизовано." }, { status: 401 })

  const { id } = await params
  const file = await orm.ExportedFile.first({ id })
  if (!file) return NextResponse.json({ message: "Файл не знайдено." }, { status: 404 })
  if (file.userId !== userId && session?.user?.role !== "ADMIN") {
    return NextResponse.json({ message: "Недостатньо прав." }, { status: 403 })
  }

  // ?inline=1 — для перегляду в діалозі (браузер рендерить/вбудовує),
  // без параметра — завантаження як файл.
  const inline = new URL(request.url).searchParams.get("inline") === "1"

  return new NextResponse(file.data as unknown as BodyInit, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  })
}