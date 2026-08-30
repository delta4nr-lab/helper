import "server-only"

import HtmlToDocx from "@turbodocx/html-to-docx"

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character)
}

function replaceFields(html: string, data: Record<string, unknown>): string {
  const normalized = html.replace(/<span\b[^>]*data-field-key=["'](\w+)["'][^>]*>[\s\S]*?<\/span>/gi, "{{$1}}")
  return normalized.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = data[key]
    return value === undefined || value === null || value === "" ? `{{${key}}}` : escapeHtml(String(value))
  })
}

function addInlineTableStyles(html: string): string {
  return html
    .replace(/<table\b([^>]*)>/gi, (match, attributes: string) => {
      const borderless = /data-borderless=["']true["']/i.test(attributes)
      const tableStyle = `border-collapse: collapse; table-layout: fixed; width: 100%;${borderless ? " border: 0 solid transparent;" : " border: 1px solid #000000;"}`
      return `<table${attributes} style="${tableStyle}">`
    })
    .replace(/<(td|th)\b([^>]*)>/gi, (match, tag: string, attributes: string, offset: number, source: string) => {
      const tableStart = source.lastIndexOf("<table", offset)
      const tableEnd = source.lastIndexOf("</table>", offset)
      const borderless = tableStart > tableEnd && /data-borderless=["']true["']/i.test(source.slice(tableStart, source.indexOf(">", tableStart) + 1))
      const style = `padding: 4px 8px; vertical-align: top; overflow-wrap: anywhere;${borderless ? " border: 0 solid transparent;" : " border: 1px solid #000000;"}`
      return `<${tag}${attributes} style="${style}">`
    })
}

function normalizeBuffer(value: ArrayBuffer | Blob | Buffer): Promise<Buffer> {
  if (Buffer.isBuffer(value)) return Promise.resolve(value)
  if (value instanceof Blob) return value.arrayBuffer().then((buffer) => Buffer.from(buffer))
  return Promise.resolve(Buffer.from(value))
}

export async function createDocxBuffer(input: {
  title: string
  header?: string | null
  body?: string | null
  footer?: string | null
  data: Record<string, unknown>
}): Promise<Buffer> {
  const html = [input.header, input.body, input.footer]
    .filter(Boolean)
    .map((part) => addInlineTableStyles(replaceFields(part ?? "", input.data)))
    .join('<div style="height: 8px;"></div>')

  const result = await HtmlToDocx(`<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8"></head><body>${html}</body></html>`, null, {
    title: input.title,
    creator: "Канцелярія",
    font: "Times New Roman",
    fontSize: 28,
    margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
    table: {
      row: { cantSplit: false },
      borderOptions: { size: 4, stroke: "single", color: "000000" },
    },
    preprocessing: { skipHTMLMinify: true },
  })

  return normalizeBuffer(result)
}
