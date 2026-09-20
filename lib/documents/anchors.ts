import "server-only"

import { loadDocxZip } from "@/lib/documents/docx-zip"

// Опис плаваючого зображення (wp:anchor + wrapNone) з document.xml.
// Зсуви — в EMU (1 px = 9525 EMU). relativeFrom: page | margin | column | paragraph.
export type DocxAnchorPosition = {
  relativeH: string | null
  offsetH: number | null
  alignH: string | null
  relativeV: string | null
  offsetV: number | null
  alignV: string | null
}

const ANCHOR_RE = /<wp:anchor\b[\s\S]*?<\/wp:anchor>/g

function readAxis(
  block: string,
  axis: "positionH" | "positionV"
): { relative: string | null; offset: number | null; align: string | null } {
  const match = new RegExp(
    `<wp:${axis}\\b([^>]*)>([\\s\\S]*?)</wp:${axis}>`
  ).exec(block)
  if (!match) return { relative: null, offset: null, align: null }

  const relative = /relativeFrom="([^"]+)"/.exec(match[1])?.[1] ?? null
  const offsetRaw = /<wp:posOffset>(-?\d+)<\/wp:posOffset>/.exec(match[2])?.[1]
  const align = /<wp:align>([^<]+)<\/wp:align>/.exec(match[2])?.[1] ?? null

  return {
    relative,
    offset: offsetRaw != null ? Number(offsetRaw) : null,
    align,
  }
}

// Витягує позиції всіх плаваючих зображень у порядку документа. Беремо лише
// wrapNone — саме вони в docx-preview рендеряться як 0×0-обгортки, які треба
// скоригувати (docx-preview ігнорує relativeFrom і ставить їх відносно абзацу).
export async function extractAnchorPositions(
  docx: Uint8Array
): Promise<DocxAnchorPosition[]> {
  const zip = await loadDocxZip(docx)
  const entry = zip.file("word/document.xml")
  if (!entry) return []

  const xml = await entry.async("string")
  const result: DocxAnchorPosition[] = []

  for (const match of xml.matchAll(ANCHOR_RE)) {
    const block = match[0]
    if (!/<wp:wrapNone\b/.test(block)) continue

    const h = readAxis(block, "positionH")
    const v = readAxis(block, "positionV")
    result.push({
      relativeH: h.relative,
      offsetH: h.offset,
      alignH: h.align,
      relativeV: v.relative,
      offsetV: v.offset,
      alignV: v.align,
    })
  }

  return result
}
