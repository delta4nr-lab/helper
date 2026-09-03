import { NextResponse } from "next/server"
import JSZip from "jszip"

import { auth } from "@/auth"
import { orm } from "@/lib/db"

type Params = { templateId: string }

// Поля-плейсхолдери: SDT з тегом отримує <w:showingPlcHdr/> — двигун поводиться
// з ними як із плейсхолдерами Word (клік → друк замінює назву поля).
// Ін'єкція на роздачі: шаблон у БД лишається без змін.
function withPlaceholderFields(xml: string): string {
  return xml.replace(/<w:sdtPr>(?:(?!<\/w:sdtPr>)[\s\S])*?<\/w:sdtPr>/g, (sdtPr) => {
    if (sdtPr.includes("showingPlcHdr") || !sdtPr.includes("<w:tag")) return sdtPr
    return sdtPr.replace("</w:sdtPr>", "<w:showingPlcHdr/></w:sdtPr>")
  })
}

export async function GET(_request: Request, { params }: { params: Promise<Params> }) {
  const session = await (auth as unknown as () => Promise<{ user?: { id?: string } } | null>)()
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Не авторизовано. Увійдіть у систему." }, { status: 401 })
  }

  const { templateId } = await params
  const template = await orm.Template.select("docxData").first({ id: templateId, isActive: true })
  if (!template?.docxData) {
    return NextResponse.json({ message: "Шаблон не знайдено або для нього немає DOCX-файлу." }, { status: 404 })
  }

  try {
    const zip = await JSZip.loadAsync(Buffer.from(template.docxData))
    const docFile = zip.file("word/document.xml")
    if (docFile) {
      const xml = await docFile.async("string")
      zip.file("word/document.xml", withPlaceholderFields(xml))
    }
    const bytes = await zip.generateAsync({ type: "uint8array" })
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'inline; filename="template.docx"',
        "Cache-Control": "private, no-store",
      },
    })
  } catch {
    // Некоректний архів — віддаємо як є, редактор покаже помилку парсинга
    return new NextResponse(Buffer.from(template.docxData), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'inline; filename="template.docx"',
        "Cache-Control": "private, no-store",
      },
    })
  }
}

