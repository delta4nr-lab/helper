import "server-only"

import { readFile } from "node:fs/promises"
import path from "node:path"
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx"
import { load } from "cheerio"

import { extractTableModel, getUsableWidthDxa } from "./parse-tables"
import { marginsDxa, mmToPx, pageSizeDxa, type PageSettings } from "../page"

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character)
}

export type SignatureImage = { name: string; buffer: Buffer; mime: string }

// Зображення документа, вбудовані з файлів сервера (src → buffer)
export type EmbeddedImage = { buffer: Buffer; mime: string }
export type ImageMap = Record<string, EmbeddedImage>

const ALIGN_MAP: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
}

// Читає зображення, на які посилається HTML, з файлової системи (public/)
async function collectEmbeddedImages(html: string): Promise<ImageMap> {
  const srcs = Array.from(html.matchAll(/<img\b[^>]*src="(\/uploads\/[^"]+)"/g)).map((m) => m[1])
  const unique = Array.from(new Set(srcs))
  const map: ImageMap = {}
  await Promise.all(
    unique.map(async (src) => {
      try {
        const rel = src.replace(/^\//, "")
        const buffer = await readFile(path.join(process.cwd(), "public", rel))
        const mime = src.endsWith(".png") ? "image/png" : src.endsWith(".webp") ? "image/webp" : "image/jpeg"
        // Word не вбудовує WEBP — пропускаємо (наприклад, при експорті webp-файлу)
        if (mime === "image/webp") return
        map[src] = { buffer, mime }
      } catch {
        // файл відсутній — зображення пропускаємо
      }
    })
  )
  return map
}

// Створює ImageRun з атрибутів <img> нашого image node (фізичні розміри в mm)
function imageRunFromImg($img: Parameters<CheerioAPI>[0], $: CheerioAPI, images?: ImageMap): ImageRun | null {
  if (!images) return null
  const src = $($img).attr("src") ?? ""
  const embedded = images[src]
  if (!embedded) return null
  const widthMm = Number($($img).attr("data-width-mm")) || 0
  const heightMm = Number($($img).attr("data-height-mm")) || 0
  if (widthMm <= 0 || heightMm <= 0) return null
  return new ImageRun({
    data: embedded.buffer,
    transformation: { width: Math.max(1, Math.round(mmToPx(widthMm))), height: Math.max(1, Math.round(mmToPx(heightMm))) },
    type: embedded.mime === "image/png" ? "png" : "jpg",
  })
}

// Визначає розміри зображення (PNG/JPEG) — для підпису під шрифт документа
function imageSize(buffer: Buffer): { width: number; height: number } {
  // PNG: після сигнатури (8) + length (4) + "IHDR" (4) йдуть width/height (big-endian)
  if (buffer.length > 24 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }
  // JPEG: шукаємо SOF-маркер
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let i = 2
    while (i < buffer.length - 8) {
      if (buffer[i] !== 0xff) {
        i += 1
        continue
      }
      const marker = buffer[i + 1]
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: buffer.readUInt16BE(i + 7), height: buffer.readUInt16BE(i + 5) }
      }
      const length = buffer.readUInt16BE(i + 2)
      i += 2 + length
    }
  }
  return { width: 100, height: 30 }
}

function replaceFields(html: string, data: Record<string, unknown>, signatureImages?: Record<string, SignatureImage>): string {
  // Збираємо назви полів (label), щоб у порожніх місцях показувати назву замість ключа
  const labels: Record<string, string> = {}
  const normalized = html.replace(/<span\b[^>]*data-field-key=["'](\w+)["'][^>]*>[\s\S]*?<\/span>/gi, (match, key: string) => {
    const labelMatch = match.match(/data-label=["']([^"']*)["']/)
    labels[key] = labelMatch ? labelMatch[1] : key
    return `{{${key}}}`
  })
  const sigKeys = new Set(Object.keys(signatureImages ?? {}))
  return normalized.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = data[key]
    if (value === undefined || value === null || value === "") return escapeHtml(labels[key] ?? key)
    // Підпис: лише зображення (без імені над ним); без зображення — ім'я
    if (sigKeys.has(key)) return `<img data-sig="${key}" />`
    return escapeHtml(String(value))
  })
}

// ── helpers inline → TextRun ────────────────────────────────────────
type CheerioAPI = ReturnType<typeof load>
type AnyNode = ReturnType<CheerioAPI>

function parseStyleMap(style?: string | null): Record<string, string> {
  if (!style) return {}
  const m: Record<string, string> = {}
  for (const part of style.split(";")) {
    const [k, ...v] = part.split(":")
    if (!k || v.length === 0) continue
    const key = k.trim().toLowerCase()
    const val = v.join(":").trim()
    if (key && val) m[key] = val
  }
  return m
}

const FONT_SIZE_RE = /^([\d.]+)\s*(px|pt|em|rem)?$/i
function fontSizeToHalfPoints(style?: string | null): number | undefined {
  if (!style) return undefined
  const m = parseStyleMap(style)["font-size"] ?? ""
  if (!m) return undefined
  const match = m.match(FONT_SIZE_RE)
  if (!match) return undefined
  const value = Number(match[1])
  if (!Number.isFinite(value)) return undefined
  const unit = (match[2] ?? "px").toLowerCase() as string
  // Округлюємо до цілих пунктів: 18px → 14pt (як у Word)
  const pt = unit === "px" ? value * 0.75 : unit === "pt" ? value : value * 16 * 0.75
  return Math.round(pt) * 2
}

const FONT_FAMILY_RE = /^(['"]?)([^'"]+)\1$/
function fontFamilyFromStyle(style?: string | null): string | undefined {
  if (!style) return undefined
  const font = parseStyleMap(style)["font-family"]
  if (!font) return undefined
  const match = font.match(FONT_FAMILY_RE)
  return match ? match[2] : font
}

function isBoldTag(tag: string) {
  return tag === "strong" || tag === "b"
}
function isItalicTag(tag: string) {
  return tag === "em" || tag === "i"
}
function isUnderlineTag(tag: string) {
  return tag === "u"
}

function collectTextRuns(
  $el: AnyNode,
  $: CheerioAPI,
  parentBold = false,
  parentItalic = false,
  parentUnderline = false,
  parentFs?: number,
  parentFontFamily?: string,
): TextRun[] {
  const runs: TextRun[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = ($el as any)[0] as { children?: unknown[]; type?: string; data?: string; name?: string; attribs?: Record<string, string> } | undefined
  const childList = raw?.children ?? []
  for (const child of childList) {
    const c = child as { type: string; data?: string; name?: string; attribs?: Record<string, string>; children?: unknown[] }
    if (c.type === "text") {
      const text = c.data ?? ""
      if (text) {
        const base: Record<string, unknown> = { text, bold: parentBold, italics: parentItalic, underline: parentUnderline ? {} : undefined }
        if (parentFs) base.size = parentFs
        if (parentFontFamily) base.font = parentFontFamily
        if (text.trim() === "" && text.length > 0) {
          runs.push(new TextRun({ text: " ", ...base }))
        } else {
          runs.push(new TextRun({ text, ...base }))
        }
      }
    } else if (c.type === "tag") {
      const tag = (c.name ?? "").toLowerCase()
      if (tag === "br") {
        runs.push(new TextRun({ break: 1 }))
      } else if (tag === "span" || tag === "a") {
        const style = parseStyleMap(c.attribs?.style)
        const bold = parentBold || style["font-weight"] === "700" || style["font-weight"] === "bold"
        const italic = parentItalic || style["font-style"] === "italic"
        const underline = parentUnderline || style["text-decoration"]?.includes("underline")
        const fs = fontSizeToHalfPoints(c.attribs?.style) ?? parentFs
        const ff = fontFamilyFromStyle(c.attribs?.style) ?? parentFontFamily
        const innerRuns = collectTextRunsFromChildren(c.children ?? [], $, bold, italic, underline ?? false, fs, ff)
        runs.push(...innerRuns)
      } else if (isBoldTag(tag) || isItalicTag(tag) || isUnderlineTag(tag)) {
        const bold = parentBold || isBoldTag(tag)
        const italic = parentItalic || isItalicTag(tag)
        const underline = parentUnderline || isUnderlineTag(tag)
        runs.push(...collectTextRunsFromChildren(c.children ?? [], $, bold, italic, underline, parentFs, parentFontFamily))
      } else {
        // невідомий тег — просто розгорнути дітей
        runs.push(...collectTextRunsFromChildren(c.children ?? [], $, parentBold, parentItalic, parentUnderline, parentFs, parentFontFamily))
      }
    }
  }
  return runs
}

function collectTextRunsFromChildren(
  children: unknown[],
  $: CheerioAPI,
  bold = false,
  italic = false,
  underline = false,
  parentFs?: number,
  parentFontFamily?: string,
): TextRun[] {
  const runs: TextRun[] = []
  for (const child of children) {
    const c = child as { type: string; data?: string; name?: string; attribs?: Record<string, string>; children?: unknown[] }
    if (c.type === "text") {
      const text = c.data ?? ""
      if (text) {
        const base: Record<string, unknown> = { text, bold, italics: italic, underline: underline ? {} : undefined }
        if (parentFs) base.size = parentFs
        if (parentFontFamily) base.font = parentFontFamily
        if (text.trim() === "") {
          if (runs.length > 0) runs.push(new TextRun({ text: " ", ...base }))
        } else {
          runs.push(new TextRun({ text, ...base }))
        }
      }
    } else if (c.type === "tag") {
      const tag = (c.name ?? "").toLowerCase()
      if (tag === "br") {
        runs.push(new TextRun({ break: 1 }))
      } else {
        const style = parseStyleMap(c.attribs?.style)
        const b = bold || isBoldTag(tag) || style["font-weight"] === "700" || style["font-weight"] === "bold"
        const it = italic || isItalicTag(tag) || style["font-style"] === "italic"
        const ul = underline || isUnderlineTag(tag) || style["text-decoration"]?.includes("underline")
        const fs = fontSizeToHalfPoints(c.attribs?.style) ?? parentFs
        const ff = fontFamilyFromStyle(c.attribs?.style) ?? parentFontFamily
        runs.push(...collectTextRunsFromChildren(c.children ?? [], $, b, it, ul ?? false, fs, ff))
      }
    }
  }
  void $
  return runs
}

function alignmentFromStyle(style?: string | null, alignAttr?: string | null): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  const m = parseStyleMap(style)
  const raw = (m["text-align"] ?? alignAttr ?? "").toLowerCase().trim()
  if (raw === "center") return AlignmentType.CENTER
  if (raw === "right") return AlignmentType.RIGHT
  if (raw === "justify") return AlignmentType.JUSTIFIED
  if (raw === "left") return AlignmentType.LEFT
  return undefined
}

const TEXT_INDENT_RE = /^([\d.]+)\s*(px|pt|cm|mm)?$/i
// Абзацний відступ ("червоний рядок") з text-indent → DXA (twips)
function textIndentFromStyle(style?: string | null): number | undefined {
  if (!style) return undefined
  const raw = parseStyleMap(style)["text-indent"] ?? ""
  if (!raw) return undefined
  const match = raw.match(TEXT_INDENT_RE)
  if (!match) return undefined
  const value = Number(match[1])
  if (!Number.isFinite(value) || value <= 0) return undefined
  const unit = (match[2] ?? "px").toLowerCase()
  // 1cm = 567 twips, 1mm = 56.7, 1pt = 20, 1px = 15
  const dxa = unit === "cm" ? value * 567 : unit === "mm" ? value * 56.7 : unit === "pt" ? value * 20 : value * 15
  return Math.round(dxa)
}

// Розбиває абзац навколо <img data-sig> → текст + вбудований зображений підпис
function signatureParagraphsFromHtml(
  htmlStr: string,
  signatureImages: Record<string, SignatureImage> | undefined,
  fs: number | undefined,
  ff: string | undefined,
  alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]
): Paragraph[] {
  const parts = htmlStr.split(/<img[^>]*data-sig="([^"]+)"[^>]*\/?>/i)
  const children: Array<TextRun | ImageRun> = []
  // Текст (до/після підпису) об'єднуємо в один абзац
  const textHtml = parts.filter((_, i) => i % 2 === 0).join(" ").trim()
  if (textHtml) {
    const $tmp = load(`<div>${textHtml}</div>`, null, false)
    children.push(...collectTextRuns($tmp("div").first(), $tmp, false, false, false, fs, ff))
  }
  // Підпис — плаваюче зображення «перед текстом», справа, не змінює розмір рядка/таблиці
  for (let i = 1; i < parts.length; i += 2) {
    const sig = signatureImages?.[parts[i] ?? ""]
    if (!sig) continue
    const type = sig.mime === "image/png" ? "png" : "jpg"
    const size = imageSize(sig.buffer)
    const targetHeight = 72 // 4em ≈ висота підпису в прев'ю
    const targetWidth = Math.max(60, Math.round((size.width / (size.height || 1)) * targetHeight))
    children.push(
      new ImageRun({
        data: sig.buffer,
        transformation: { width: targetWidth, height: targetHeight },
        type,
        floating: {
          horizontalPosition: { relative: "margin", align: "right" },
          verticalPosition: { relative: "line", align: "center" },
          allowOverlap: true,
          behindDocument: false, // «перед текстом»
          zIndex: 1,
        },
      })
    )
  }
  return [new Paragraph({ alignment, children })]
}

function cellParagraphsFromHtml(html: string, signatureImages?: Record<string, SignatureImage>, images?: ImageMap): Paragraph[] {
  if (!html.trim()) return [new Paragraph({ children: [] })]
  // Обгортаємо щоб cheerio не додав html/body
  const $ = load(`<div>${html}</div>`, null, false)
  const $wrap = $("div").first()
  const out: Paragraph[] = []
  // Якщо всередині комірки є <p> — кожен <p> → окремий Paragraph
  const $ps = $wrap.find("p, h1, h2, h3, div, li")
  if ($ps.length > 0) {
    $ps.each((_, el) => {
      const $el = $(el)
      // Пропускаємо вкладені p всередині li тощо — обробляємо рекурсивно, тут беремо тільки прямі
      const tag = (el as unknown as { name?: string }).name?.toLowerCase() ?? "p"
      const style = $el.attr("style") ?? ""
      const alignAttr = $el.attr("align") ?? null
      const alignment = alignmentFromStyle(style, alignAttr)
      const heading =
        tag === "h1" ? HeadingLevel.HEADING_1 : tag === "h2" ? HeadingLevel.HEADING_2 : tag === "h3" ? HeadingLevel.HEADING_3 : undefined
      const fs = fontSizeToHalfPoints(style)
      const ff = fontFamilyFromStyle(style)
      const runs = collectTextRuns($el, $, false, false, false, fs, ff)
      // Підпис у комірці — текст + зображення
      if ($el.find("img[data-sig]").length > 0) {
        out.push(...signatureParagraphsFromHtml($el.html() ?? "", signatureImages, fs, ff, alignment))
        return
      }
      if ($el.find('img[src^="/uploads/"]').length > 0) {
        const children: (TextRun | ImageRun)[] = collectTextRuns($el, $, false, false, false, fs, ff)
        $el.find('img[src^="/uploads/"]').each((_, imgEl) => {
          const run = imageRunFromImg(imgEl, $, images)
          if (run) children.push(run)
        })
        out.push(new Paragraph({ heading, alignment, children }))
        return
      }
      // Порожній <p> — пропущений рядок ентером: зберігаємо відступ як порожній параграф
      if (runs.length === 0 && !$el.text().trim()) {
        out.push(new Paragraph({ children: [] }))
        return
      }
      const props: Record<string, unknown> = { heading, alignment, children: runs.length ? runs : [new TextRun({ text: $el.text() || "" })] }
      if (fs) (props as Record<string, unknown>)["size"] = fs
      const indent = textIndentFromStyle(style)
      if (indent) props["indent"] = { firstLine: indent }
      out.push(new Paragraph(props))
    })
    // Текст поза <p> (наприклад прямий текст в <td>)
    const directText = $wrap.contents().filter((_, el) => (el as unknown as { type: string }).type === "text").text().trim()
    if (directText && out.length === 0) out.push(new Paragraph({ children: [new TextRun({ text: directText })] }))
    if (out.length === 0) out.push(new Paragraph({ children: [new TextRun({ text: $wrap.text() || "" })] }))
    return out
  }
  // Немає блочних — один параграф з інлайнами
  if ($wrap.find("img[data-sig]").length > 0) {
    return signatureParagraphsFromHtml(
      $wrap.html() ?? "",
      signatureImages,
      fontSizeToHalfPoints($wrap.attr("style") ?? ""),
      fontFamilyFromStyle($wrap.attr("style") ?? ""),
      alignmentFromStyle($wrap.attr("style"))
    )
  }
  if ($wrap.find('img[src^="/uploads/"]').length > 0) {
    const children: (TextRun | ImageRun)[] = collectTextRuns($wrap, $, false, false, false, fontSizeToHalfPoints($wrap.attr("style") ?? ""), fontFamilyFromStyle($wrap.attr("style") ?? ""))
    $wrap.find('img[src^="/uploads/"]').each((_, imgEl) => {
      const run = imageRunFromImg(imgEl, $, images)
      if (run) children.push(run)
    })
    return [new Paragraph({ alignment: alignmentFromStyle($wrap.attr("style")), children })]
  }
  const runs = collectTextRuns($wrap, $, false, false, false, fontSizeToHalfPoints($wrap.attr("style") ?? ""), fontFamilyFromStyle($wrap.attr("style") ?? ""))
  return [new Paragraph({ alignment: alignmentFromStyle($wrap.attr("style")), children: runs.length ? runs : [new TextRun({ text: $wrap.text() || "" })] })]
}

function htmlToDocxBlocks(html: string, page?: PageSettings | null, signatureImages?: Record<string, SignatureImage>, images?: ImageMap): (Paragraph | Table)[] {
  const $ = load(`<div id="root">${html}</div>`, null, false)
  const $root = $("#root")
  const blocks: (Paragraph | Table)[] = []

  // Ітеруємо топ-рівень #root children в порядку
  $root.contents().each((_, node) => {
    const n = node as unknown as { type: string; name?: string; attribs?: Record<string, string>; children?: unknown[] }
    if (n.type === "text") {
      const t = (n as unknown as { data: string }).data?.trim()
      if (t) blocks.push(new Paragraph({ children: [new TextRun({ text: t })] }))
      return
    }
    if (n.type !== "tag") return
    const tag = (n.name ?? "").toLowerCase()
    if (tag === "table") {
      const $table = $(node as unknown as Parameters<CheerioAPI>[0])
      const model = extractTableModel($table, $, page)
      const table = buildDocxTable(model, page, signatureImages, images)
      blocks.push(table)
      return
    }
    if (tag === "p" || tag === "div" || tag === "h1" || tag === "h2" || tag === "h3") {
      const $el = $(node as unknown as Parameters<CheerioAPI>[0])
      const style = $el.attr("style") ?? ""
      const alignAttr = $el.attr("align") ?? null
      const alignment = alignmentFromStyle(style, alignAttr)
      const heading =
        tag === "h1" ? HeadingLevel.HEADING_1 : tag === "h2" ? HeadingLevel.HEADING_2 : tag === "h3" ? HeadingLevel.HEADING_3 : undefined
      const fs = fontSizeToHalfPoints(style)
      const ff = fontFamilyFromStyle(style)
      const runs = collectTextRuns($el, $, false, false, false, fs, ff)
      // Порожній <p> — пропущений рядок ентером: зберігаємо відступ як порожній параграф (якщо всередині немає таблиць/підпису)
      if (runs.length === 0 && !$el.text().trim() && $el.find("table").length === 0 && $el.find("img[data-sig]").length === 0) {
        blocks.push(new Paragraph({ children: [] }))
        return
      }
      // Якщо всередині div є таблиці — вони вже оброблені вище як окремі топ-блоки? Тут div може містити таблицю — розгортаємо
      if ($el.find("table").length > 0) {
        // Спочатку текст до таблиці
        const before = $el.clone()
        before.find("table").remove()
        const beforeText = before.text().trim()
        if (beforeText) blocks.push(new Paragraph({ heading, alignment, children: collectTextRuns(before, $, false, false, false, fs, ff) }))
        $el.find("table").each((_, tEl) => {
          const $t = $(tEl)
          const m = extractTableModel($t, $, page)
          blocks.push(buildDocxTable(m, page, signatureImages, images))
        })
        return
      }
      // Підпис (зображення): текст + вбудований підпис
      if ($el.find("img[data-sig]").length > 0) {
        blocks.push(...signatureParagraphsFromHtml($el.html() ?? "", signatureImages, fs, ff, alignment))
        return
      }
      // Зображення документа (наші): текст + вбудовані зображення
      if ($el.find('img[src^="/uploads/"]').length > 0) {
        const children: (TextRun | ImageRun)[] = collectTextRuns($el, $, false, false, false, fs, ff)
        $el.find('img[src^="/uploads/"]').each((_, imgEl) => {
          const run = imageRunFromImg(imgEl, $, images)
          if (run) children.push(run)
        })
        blocks.push(new Paragraph({ heading, alignment, children }))
        return
      }
      const paraProps: Record<string, unknown> = { heading, alignment, children: runs.length ? runs : [new TextRun({ text: $el.text() || "" })] }
      if (fs) paraProps["size"] = fs
      const indent = textIndentFromStyle(style)
      if (indent) paraProps["indent"] = { firstLine: indent }
      blocks.push(new Paragraph(paraProps))
      return
    }
    if (tag === "ul" || tag === "ol") {
      const $el = $(node as unknown as Parameters<CheerioAPI>[0])
      $el.find("li").each((_, li) => {
        const $li = $(li)
        const fs = fontSizeToHalfPoints($li.attr("style") ?? "")
        const ff = fontFamilyFromStyle($li.attr("style") ?? "")
        const runs = collectTextRuns($li, $, false, false, false, fs, ff)
        blocks.push(
          new Paragraph({
            bullet: tag === "ul" ? { level: 0 } : undefined,
            numbering: tag === "ol" ? { reference: "default-numbering", level: 0 } : undefined,
            children: runs.length ? runs : [new TextRun({ text: $li.text() || "" })],
          })
        )
      })
      return
    }
    if (tag === "br") {
      blocks.push(new Paragraph({ children: [] }))
      return
    }
    if (tag === "img") {
      const $img = $(node as unknown as Parameters<CheerioAPI>[0])
      const run = imageRunFromImg(node as unknown as Parameters<CheerioAPI>[0], $, images)
      if (run) {
        const align = ($img.attr("data-align") ?? "left") as string
        const pageBreakBefore = $img.attr("data-page-break") === "true"
        blocks.push(new Paragraph({ alignment: ALIGN_MAP[align] ?? AlignmentType.LEFT, pageBreakBefore, children: [run] }))
      }
      return
    }
    // Інше — спробувати як параграф
    const $el = $(node as unknown as Parameters<CheerioAPI>[0])
    const fs = fontSizeToHalfPoints($el.attr("style") ?? "")
    const ff = fontFamilyFromStyle($el.attr("style") ?? "")
    const runs = collectTextRuns($el, $, false, false, false, fs, ff)
    if (runs.length > 0 || $el.text().trim()) blocks.push(new Paragraph({ children: runs, ...(fs ? { size: fs } : {}) }))
  })

  return blocks
}

function buildDocxTable(model: ReturnType<typeof extractTableModel>, page?: PageSettings | null, signatureImages?: Record<string, SignatureImage>, images?: ImageMap): Table {
  const { isBorderless, width, rows } = model
  let { colWidthsDxa } = model

  // Ширина таблиці — завжди DXA для консистентності з columnWidths.
  // percent — відсоток від usable, fixed — точна ширина автора, auto — вся ширина аркуша
  const usable = getUsableWidthDxa(page)
  const tableWidthDxa = width.mode === "percent" ? Math.round((usable * width.size) / 100) : width.size
  const tableWidth = { size: tableWidthDxa, type: WidthType.DXA }

  // Захисна синхронізація: якщо сума колонок не дорівнює ширині таблиці (старі шаблони, округлення) — масштабуємо пропорційно, щоб зберегти заданий розмір
  const sumCols = colWidthsDxa.reduce((a, b) => a + b, 0)
  if (sumCols > 0 && Math.abs(sumCols - tableWidthDxa) > 5) {
    const ratio = tableWidthDxa / sumCols
    colWidthsDxa = colWidthsDxa.map((w) => Math.round(w * ratio))
    const newSum = colWidthsDxa.reduce((a, b) => a + b, 0)
    const diff = tableWidthDxa - newSum
    if (diff !== 0) colWidthsDxa[colWidthsDxa.length - 1] += diff
  }

  const borders = isBorderless
    ? {
        top: { style: BorderStyle.NONE, size: 0, color: "auto" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
        left: { style: BorderStyle.NONE, size: 0, color: "auto" },
        right: { style: BorderStyle.NONE, size: 0, color: "auto" },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
      }
    : {
        top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
        left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
        insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      }

  const cellBorders = isBorderless
    ? {
        top: { style: BorderStyle.NONE, size: 0, color: "auto" },
        bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
        left: { style: BorderStyle.NONE, size: 0, color: "auto" },
        right: { style: BorderStyle.NONE, size: 0, color: "auto" },
      }
    : {
        top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
        left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
        right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
      }

  // Будуємо рядки — враховуємо colspan (сума ширин колонок)
  const docxRows = rows.map((row) => {
    let colIndex = 0
    const cells = row.map((cell) => {
      const span = Math.max(1, cell.colspan)
      // Сума ширин колонок під colspan
      let w = 0
      for (let i = 0; i < span; i++) w += colWidthsDxa[colIndex + i] ?? 0
      if (w === 0) w = Math.floor(tableWidthDxa / row.length)
      colIndex += span

      const paragraphs = cellParagraphsFromHtml(cell.html, signatureImages, images)
      return new TableCell({
        columnSpan: span,
        rowSpan: cell.rowspan > 1 ? cell.rowspan : undefined,
        width: { size: w, type: WidthType.DXA },
        borders: cellBorders,
        verticalAlign: VerticalAlign.TOP,
        margins: { top: 55, bottom: 55, left: 115, right: 115 },
        children: paragraphs.length ? paragraphs : [new Paragraph({ children: [] })],
      })
    })
    return new TableRow({ children: cells, cantSplit: false })
  })

  return new Table({
    width: tableWidth,
    columnWidths: colWidthsDxa,
    layout: TableLayoutType.FIXED,
    borders,
    rows: docxRows,
  })
}

export async function createDocxBuffer(input: {
  title: string
  header?: string | null
  body?: string | null
  footer?: string | null
  data: Record<string, unknown>
  page: PageSettings
  signatureImages?: Record<string, SignatureImage>
}): Promise<Buffer> {
  const parts = [input.header, input.body, input.footer].filter(Boolean) as string[]
  const html = parts.map((part) => replaceFields(part, input.data, input.signatureImages)).join('<p></p>')

  const images = await collectEmbeddedImages(html)

  const blocks = html.trim() ? htmlToDocxBlocks(html, input.page, input.signatureImages, images) : []

  // Якщо жодного блоку — додамо заголовок
  const children: (Paragraph | Table)[] =
    blocks.length > 0 ? blocks : [new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: input.title, bold: true })] })]

  // Бібліотека docx для landscape сама обмінює width/height місцями,
  // тому передаємо розміри в портретній орієнтації, а орієнтацію — окремо.
  const pageSize = pageSizeDxa({ ...input.page, orientation: "portrait" })
  const margin = marginsDxa(input.page)
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Times New Roman",
            size: 28, // 14pt — базовий розмір редактора (18px ≈ 14pt у Word)
          },
        },
      },
    },
    numbering: {
      config: [{ reference: "default-numbering", levels: [{ level: 0, format: "decimal" as const, text: "%1.", alignment: AlignmentType.LEFT }] }],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: pageSize.width,
              height: pageSize.height,
              orientation: input.page.orientation === "landscape" ? ("landscape" as const) : ("portrait" as const),
            },
            margin: { top: margin.top, right: margin.right, bottom: margin.bottom, left: margin.left },
          },
        },
        children,
      },
    ],
    title: input.title,
    creator: "Канцелярія",
  })

  const buffer = await Packer.toBuffer(doc)
  return Buffer.from(buffer)
}