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
  // Для розв'язки спеціальних слотів (підпис / звання / ПІБ / посада) зі штату
  personnel?: Array<{
    id: string
    lastName: string
    firstName: string
    middleName: string | null
    rank: string
    position: string
    signaturePath: string | null
  }>
  fields?: Array<{ key: string; type: string }>
}

type PreviewPerson = {
  name: string
  rank: string
  position: string
  signaturePath: string | null
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

// Порожнє поле → чіп із назвою; заповнене → звичайний текст (як у фінальному документі).
// Спеціальні слоти (signature/rank/person/position) розв'язуються через штат (personnelMap).
function renderWithFields(
  html: string | null | undefined,
  data: Record<string, unknown>,
  ctx?: { fieldTypes?: Record<string, string>; personnelMap?: Record<string, PreviewPerson> }
): string {
  if (!html) return ""
  const fieldTypes = ctx?.fieldTypes ?? {}
  const personnelMap = ctx?.personnelMap ?? {}
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
    const type = fieldTypes[key]
    const person = personnelMap[String(v)]
    if (type === "signature") {
      // Лише зображення підпису; без фото — ім'я як заглушка
      if (person?.signaturePath) {
        return `<span class="signature-slot"><img class="signature-img" src="${escapeHtml(person.signaturePath)}" alt="підпис" /></span>`
      }
      return escapeHtml(person?.name ?? String(v))
    }
    if (type === "rank") return escapeHtml(person?.rank ?? String(v))
    if (type === "person") return escapeHtml(person?.name ?? String(v))
    if (type === "position") return escapeHtml(person?.position ?? String(v))
    return escapeHtml(String(v))
  })
}

export function DocumentRenderer({ templateId, data, personnelLabel, authorLabel, headerTemplate, bodyTemplate, footerTemplate, paper, personnel, fields }: Props) {
  const isLandscape = paper === "А4 альбом"
  const w = isLandscape ? A4_PX.landscapeWidth : A4_PX.width
  const h = isLandscape ? A4_PX.landscapeHeight : A4_PX.height
  // Якщо шаблон має кастомні header/body/footer (створені через Tiptap) — рендеримо їх
  if (headerTemplate || bodyTemplate || footerTemplate) {
    const d = (data as Record<string, unknown>) ?? {}
    const fieldTypes = Object.fromEntries((fields ?? []).map((field) => [field.key, field.type]))
    const personnelMap: Record<string, PreviewPerson> = Object.fromEntries(
      (personnel ?? []).map((person) => [
        person.id,
        {
          name: [person.firstName, person.middleName, person.lastName].filter(Boolean).join(" "),
          rank: person.rank,
          position: person.position,
          signaturePath: person.signaturePath ?? null,
        },
      ])
    )
    const ctx = { fieldTypes, personnelMap }
    const headerHtml = protectFieldSpacing(renderWithFields(headerTemplate ?? "", d, ctx))
    const bodyHtml = protectFieldSpacing(renderWithFields(bodyTemplate ?? "", d, ctx))
    const footerHtml = protectFieldSpacing(renderWithFields(footerTemplate ?? "", d, ctx))
    return (
      <div
        className="a4-paper mx-auto bg-white text-[13px] leading-relaxed text-zinc-900 shadow-sm ring-1 ring-black/5"
        style={{ fontFamily: "Times New Roman, serif", width: w, minHeight: h, padding: A4_PADDING, boxSizing: "border-box", maxWidth: "100%" }}
      >
        {headerHtml && <div className="mb-4 text-right text-[18px] leading-tight" dangerouslySetInnerHTML={{ __html: headerHtml }} />}
        {bodyHtml ? (
          <div
            className="document-preview-content prose prose-sm max-w-none"
            style={{ fontSize: "18px" }}
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        ) : (
          <p className="text-justify">Прошу розглянути рапорт...</p>
        )}
        {footerHtml && <div className="mt-6 border-t pt-3 text-[18px]" dangerouslySetInnerHTML={{ __html: footerHtml }} />}
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
