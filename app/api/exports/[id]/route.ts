import { NextResponse } from "next/server"

import { getSessionUser } from "@/lib/auth"
import { orm } from "@/lib/db"
import { extractAnchorPositions } from "@/lib/documents/anchors"
import { DocxTooLargeError } from "@/lib/documents/docx-zip"

type Params = { id: string }

export async function GET(
  request: Request,
  { params }: { params: Promise<Params> }
) {
  const user = await getSessionUser()
  const userId = user?.id
  if (!userId)
    return NextResponse.json({ message: "Не авторизовано." }, { status: 401 })

  const { id } = await params
  const file = await orm.ExportedFile.first({ id })
  if (!file)
    return NextResponse.json({ message: "Файл не знайдено." }, { status: 404 })
  if (file.userId !== userId && user?.role !== "ADMIN") {
    return NextResponse.json({ message: "Недостатньо прав." }, { status: 403 })
  }

  // ?anchors=1 — метадані плаваючих зображень для коректного прев'ю
  // (docx-preview не враховує relativeFrom). ?inline=1 — перегляд.
  const url = new URL(request.url)
  if (url.searchParams.get("anchors") === "1") {
    try {
      const anchors = await extractAnchorPositions(Buffer.from(file.data))
      return NextResponse.json({ anchors })
    } catch (error) {
      if (error instanceof DocxTooLargeError) {
        return NextResponse.json(
          {
            message:
              "Файл завеликий для обробки (перевищено ліміт розпакування).",
          },
          { status: 413 }
        )
      }
      return NextResponse.json(
        { message: "Не вдалося обробити документ." },
        { status: 400 }
      )
    }
  }

  const inline = url.searchParams.get("inline") === "1"

  return new NextResponse(file.data as unknown as BodyInit, {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  })
}
