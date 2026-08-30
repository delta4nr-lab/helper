import { RaportVidpustkaTemplate } from "@/lib/documents/templates/raport-vidpustka"
import { RaportVidryadzhennyaTemplate } from "@/lib/documents/templates/raport-vidryadzhennya"
import { A4_PX, A4_PADDING } from "@/components/editor/a4-page"

type Props = {
  templateId: string
  data: unknown
  personnelLabel?: string
  authorLabel?: string
  headerTemplate?: string | null
  bodyTemplate?: string | null
  footerTemplate?: string | null
  paper?: string | null
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c)
}

// Пробіли одразу навколо чіпа поля → нерозривні (не розтягуються при вирівнюванні по ширині).
// Інакше justify розтягує звичайний пробіл перед чіпом і з'являється великий відступ зліва.
function protectFieldSpacing(html: string): string {
  return html
    .replace(/\s+(?=<span[^>]*class="[^"]*field-chip)/gi, "&nbsp;")
    .replace(/(<span[^>]*class="[^"]*field-chip[^"]*">[\s\S]*?<\/span>)\s+/gi, "$1&nbsp;")
}

function renderWithFields(html: string | null | undefined, data: Record<string, unknown>): string {
  if (!html) return ""
  // Збираємо назви полів (label), щоб у порожніх місцях показувати назву замість ключа
  const labels: Record<string, string> = {}
  const normalized = html.replace(/<span\b[^>]*data-field-key=["'](\w+)["'][^>]*>[\s\S]*?<\/span>/gi, (match, key: string) => {
    const labelMatch = match.match(/data-label=["']([^"']*)["']/)
    labels[key] = labelMatch ? labelMatch[1] : key
    return `{{${key}}}`
  })
  return normalized.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = data[key]
    if (v === undefined || v === null || v === "") {
      return `<span class="field-chip">${escapeHtml(labels[key] ?? key)}</span>`
    }
    return `<span class="field-chip">${escapeHtml(String(v))}</span>`
  })
}

export function DocumentRenderer({ templateId, data, personnelLabel, authorLabel, headerTemplate, bodyTemplate, footerTemplate, paper }: Props) {
  const isLandscape = paper === "А4 альбом"
  const w = isLandscape ? A4_PX.landscapeWidth : A4_PX.width
  const h = isLandscape ? A4_PX.landscapeHeight : A4_PX.height
  // Якщо шаблон має кастомні header/body/footer (створені через Tiptap) — рендеримо їх
  if (headerTemplate || bodyTemplate || footerTemplate) {
    const d = (data as Record<string, unknown>) ?? {}
    const headerHtml = protectFieldSpacing(renderWithFields(headerTemplate ?? "", d))
    const bodyHtml = protectFieldSpacing(renderWithFields(bodyTemplate ?? "", d))
    const footerHtml = protectFieldSpacing(renderWithFields(footerTemplate ?? "", d))
    return (
      <div
        className="a4-paper mx-auto bg-white text-[13px] leading-relaxed text-zinc-900 shadow-sm ring-1 ring-black/5"
        style={{ fontFamily: "Times New Roman, serif", width: w, minHeight: h, padding: A4_PADDING, boxSizing: "border-box", maxWidth: "100%" }}
      >
        {headerHtml && <div className="mb-4 text-right text-[11px] leading-tight text-zinc-600" dangerouslySetInnerHTML={{ __html: headerHtml }} />}
        {bodyHtml ? (
          <div
            className="document-preview-content prose prose-sm max-w-none"
            style={{ fontSize: "18px" }}
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        ) : (
          <p className="text-justify">Прошу розглянути рапорт...</p>
        )}
        {footerHtml && <div className="mt-6 border-t pt-3 text-[11px]" dangerouslySetInnerHTML={{ __html: footerHtml }} />}
        {personnelLabel && <div className="mt-4 text-xs text-muted-foreground">Особовий склад: {personnelLabel}</div>}
        {authorLabel && <div className="text-xs text-muted-foreground">Автор: {authorLabel}</div>}
      </div>
    )
  }

  if (templateId === "raport-vidryadzhennya") {
    return <RaportVidryadzhennyaTemplate data={data as never} personnelLabel={personnelLabel} authorLabel={authorLabel} />
  }
  if (templateId === "raport-vidpustka") {
    return <RaportVidpustkaTemplate data={data as never} personnelLabel={personnelLabel} authorLabel={authorLabel} />
  }

  // Fallback для інших шаблонів — JSON preview (тимчасово, поки не додано шаблон)
  return (
    <div className="mx-auto rounded-xl border bg-muted/20 p-6" style={{ width: w, maxWidth: "100%" }}>
      <p className="text-sm font-medium">Попередній перегляд для {templateId} в розробці</p>
      <pre className="mt-3 overflow-auto rounded-lg bg-white p-3 text-xs">{JSON.stringify(data, null, 2)}</pre>
      {personnelLabel && <p className="mt-2 text-xs text-muted-foreground">Особовий склад: {personnelLabel}</p>}
    </div>
  )
}
