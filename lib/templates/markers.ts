// Маркери {{Назва поля}} → content controls у word/document.xml.
//
// Структура SDT — 1-в-1 з робочим зразком персонального шаблона (без <w:text/>,
// який ламає рендер): sdtPr (id, tag, alias) + sdtContent (run із назвою поля).
// Чиста функція без серверних залежностей — використовується і в action
// збереження, і в тестах.

export type MarkerField = { key: string; label: string }

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

let sdtIdSeed = 1_000_000_000 + Math.floor(Math.random() * 1_000_000)

function nextSdtId(): number {
  const id = sdtIdSeed
  sdtIdSeed += 1
  return id
}

function sdtXml(key: string, escapedLabel: string): string {
  return (
    `<w:sdt><w:sdtPr><w:id w:val="${nextSdtId()}"/>` +
    `<w:tag w:val="${escapeXml(key)}"/><w:alias w:val="${escapedLabel}"/><w:showingPlcHdr/></w:sdtPr>` +
    `<w:sdtContent><w:r><w:t xml:space="preserve">${escapedLabel}</w:t></w:r></w:sdtContent></w:sdt>`
  )
}

function replaceMarker(
  xml: string,
  marker: string,
  key: string,
  escapedLabel: string
): string {
  const runPattern = new RegExp(
    "<w:r(?:\\s[^>]*)?>(?:(?!</w:r>)[\\s\\S])*?<w:t[^>]*>((?:(?!</w:t>)[\\s\\S])*?)</w:t>(?:(?!</w:r>)[\\s\\S])*?</w:r>",
    "g"
  )
  return xml.replace(runPattern, (run) => {
    const textMatch = run.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/)
    if (!textMatch || !textMatch[1].includes(marker)) return run
    const rPr = run.match(/<w:rPr>[\s\S]*?<\/w:rPr>/)?.[0] ?? ""
    const sdt = sdtXml(key, escapedLabel)
    const segments = textMatch[1].split(marker)
    const parts: string[] = []
    for (let index = 0; index < segments.length; index += 1) {
      if (segments[index]) {
        parts.push(
          `<w:r>${rPr}<w:t xml:space="preserve">${segments[index]}</w:t></w:r>`
        )
      }
      if (index < segments.length - 1) parts.push(sdt)
    }
    return parts.join("")
  })
}

// Замінює всі {{key}} маркери на content controls (showingPlcHdr — плейсхолдер).
// Довші ключі — першими, щоб короткий ключ не зʼїв префікс довшого.
export function applyTemplateMarkers(
  xml: string,
  fields: MarkerField[]
): string {
  const sorted = [...fields].sort((a, b) => b.key.length - a.key.length)
  let result = xml
  for (const field of sorted) {
    const marker = `{{${field.key}}}`
    if (!result.includes(marker)) continue
    result = replaceMarker(result, marker, field.key, escapeXml(field.label))
  }
  return result
}
