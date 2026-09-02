import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { orm } from "@/lib/db"

type Params = { id: string }

export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await (auth as unknown as () => Promise<{ user?: { id?: string; role?: string } } | null>)()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ message: "Не авторизовано." }, { status: 401 })

  const { id } = await params
  const file = await orm.ExportedFile.first({ id })
  if (!file) return NextResponse.json({ message: "Файл не знайдено." }, { status: 404 })
  if (file.userId !== userId && session?.user?.role !== "ADMIN") {
    return NextResponse.json({ message: "Недостатньо прав." }, { status: 403 })
  }

  return new NextResponse(file.data as unknown as BodyInit, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.size),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  })
}