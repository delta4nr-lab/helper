import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { createDocxBuffer } from "@/lib/documents/export/docx"

type Params = { id: string }

export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await (auth as unknown as () => Promise<{ user?: { id?: string; role?: string } } | null>)()
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ message: "Не авторизовано" }, { status: 401 })

  const { id } = await params
  const document = await prisma.document.findUnique({
    where: { id },
    include: { template: true, personnel: true },
  })
  if (!document) return NextResponse.json({ message: "Документ не знайдено" }, { status: 404 })

  const isAdmin = session?.user?.role === "ADMIN"
  if (!isAdmin && document.authorId !== userId) {
    return NextResponse.json({ message: "Недостатньо прав" }, { status: 403 })
  }

  const data = (document.data as Record<string, unknown>) ?? {}
  if (document.personnel) {
    data.personnelName = [document.personnel.lastName, document.personnel.firstName, document.personnel.middleName]
      .filter(Boolean)
      .join(" ")
  }

  const buffer = await createDocxBuffer({
    title: document.title,
    header: document.template.headerTemplate,
    body: document.template.bodyTemplate,
    footer: document.template.footerTemplate,
    data,
  })

  const filename = `${document.title.replace(/[^\p{L}\p{N}\s-]/gu, "").trim() || "document"}.docx`
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  })
}
