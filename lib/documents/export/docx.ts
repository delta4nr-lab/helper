import "server-only"

import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  UnderlineType,
} from "docx"

function replaceFields(value: string, data: Record<string, unknown>): string {
  return value.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const field = data[key]
    return field === undefined || field === null ? `{{${key}}}` : String(field)
  })
}

function textRuns(html: string, data: Record<string, unknown>): TextRun[] {
  const runs: TextRun[] = []
  let font = "Times New Roman"
  let size = 28
  let bold = false
  let italics = false
  let underline = false

  for (const token of html.replace(/<br\s*\/?>/gi, "\n").split(/(<[^>]+>)/g)) {
    if (!token) continue
    if (token.startsWith("<")) {
      const tag = token.toLowerCase()
      if (/^<(strong|b)(\s|>)/.test(tag)) bold = true
      if (/^<\/(strong|b)>/.test(tag)) bold = false
      if (/^<(em|i)(\s|>)/.test(tag)) italics = true
      if (/^<\/(em|i)>/.test(tag)) italics = false
      if (/^<u(\s|>)/.test(tag)) underline = true
      if (/^<\/u>/.test(tag)) underline = false
      const family = token.match(/font-family:\s*([^;"']+)/i)?.[1]?.trim()
      const pixels = token.match(/font-size:\s*([\d.]+)px/i)?.[1]
      if (family) font = family
      if (pixels) size = Math.round(Number(pixels) * 1.5)
      continue
    }
    const text = token
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&#39;|&apos;/gi, "'")
    if (text) runs.push(new TextRun({ text: replaceFields(text, data), bold, italics, font, size, underline: underline ? { type: UnderlineType.SINGLE } : undefined }))
  }
  return runs.length ? runs : [new TextRun("")]
}

function paragraphsFromHtml(html: string, data: Record<string, unknown>): Paragraph[] {
  const normalized = html.replace(/<span\b([^>]*data-field-key=["'](\w+)["'][^>]*)>[\s\S]*?<\/span>/gi, "{{$2}}")
  const blocks = normalized.match(/<(h[1-3]|p|li|div)[^>]*>[\s\S]*?<\/(?:h[1-3]|p|li|div)>/gi) ?? [normalized]

  return blocks.map((block) => {
    const heading = block.match(/^<h([1-3])/i)?.[1]
    const alignment = /text-align\s*:\s*right/i.test(block)
      ? AlignmentType.RIGHT
      : /text-align\s*:\s*center/i.test(block)
        ? AlignmentType.CENTER
        : /text-align\s*:\s*justify/i.test(block)
          ? AlignmentType.JUSTIFIED
          : AlignmentType.LEFT

    return new Paragraph({
      heading: heading === "1" ? HeadingLevel.HEADING_1 : heading === "2" ? HeadingLevel.HEADING_2 : heading === "3" ? HeadingLevel.HEADING_3 : undefined,
      alignment,
      bullet: /^<li/i.test(block) ? { level: 0 } : undefined,
      children: textRuns(block.replace(/^<[^>]+>|<\/[^>]+>$/g, ""), data),
    })
  })
}

export async function createDocxBuffer(input: {
  title: string
  header?: string | null
  body?: string | null
  footer?: string | null
  data: Record<string, unknown>
}): Promise<Buffer> {
  const children = [
    ...paragraphsFromHtml(input.header ?? "", input.data),
    ...paragraphsFromHtml(input.body ?? "", input.data),
    ...paragraphsFromHtml(input.footer ?? "", input.data),
  ]

  const document = new Document({
    title: input.title,
    sections: [{ properties: {}, children: children.length ? children : [new Paragraph("")] }],
  })

  return Packer.toBuffer(document)
}
