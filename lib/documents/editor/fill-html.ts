// Трансформація HTML шаблону у редагований вміст редактора заповнення.
// Плейсхолдери {{key}} та field-chip спани адмін-редактора → жовті fill-спани.

export type FillFieldMeta = { label?: string; type?: string }

function escapeAttr(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c)
}

function escapeText(value: string): string {
  return value.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c)
}

function fillSpan(key: string, label: string, type: string): string {
  return `<span data-fill-key="${escapeAttr(key)}" data-fill-type="${escapeAttr(type)}" data-fill-label="${escapeAttr(label)}">${escapeText(label)}</span>`
}

// Перетворює HTML шаблону (плейсхолдери + спани адмін-редактора) у fill-спани.
export function toEditableHtml(html: string, metaByKey: Record<string, FillFieldMeta>): string {
  // Спочатку спани адмін-редактора (<span data-field-key>), щоб їх вміст не попав у {{key}}-regex
  let out = html.replace(/<span\b[^>]*data-field-key=["'](\w+)["'][^>]*>[\s\S]*?<\/span>/gi, (match, key: string) => {
    const meta = metaByKey[key] ?? {}
    const label = match.match(/data-label=["']([^"']*)["']/)?.[1] ?? meta.label ?? key
    const type = match.match(/data-field-type=["'](\w+)["']/)?.[1] ?? meta.type ?? "text"
    return fillSpan(key, label, type)
  })
  out = out.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const meta = metaByKey[key] ?? {}
    const label = meta.label ?? key
    const type = meta.type ?? "text"
    return fillSpan(key, label, type)
  })
  return out
}

// Збирає єдиний HTML документа з header/body/footer. Повертає null, якщо вмісту немає.
export function composeDocumentHtml(
  parts: { header?: string | null; body?: string | null; footer?: string | null },
  fields: { key: string; label?: string | null; type?: string | null }[]
): string | null {
  const html = [parts.header, parts.body, parts.footer].filter(Boolean).join("\n")
  if (!html.trim()) return null
  const metaByKey: Record<string, FillFieldMeta> = {}
  for (const f of fields) metaByKey[f.key] = { label: f.label ?? undefined, type: f.type ?? undefined }
  return toEditableHtml(html, metaByKey)
}