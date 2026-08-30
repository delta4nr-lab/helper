import { RaportVidpustkaTemplate } from "@/lib/documents/templates/raport-vidpustka"
import { RaportVidryadzhennyaTemplate } from "@/lib/documents/templates/raport-vidryadzhennya"

type Props = {
  templateId: string
  data: unknown
  personnelLabel?: string
  authorLabel?: string
  headerTemplate?: string | null
  bodyTemplate?: string | null
  footerTemplate?: string | null
}

function renderWithFields(html: string | null | undefined, data: Record<string, unknown>): string {
  if (!html) return ""
  const normalized = html.replace(/<span\b([^>]*data-field-key=["'](\w+)["'][^>]*)>[\s\S]*?<\/span>/gi, "{{$2}}")
  return normalized.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = data[key]
    if (v === undefined || v === null || v === "") return `<span class="rounded bg-amber-100 px-1 text-amber-900 ring-1 ring-amber-200">{{${key}}}</span>`
    return `<span class="rounded bg-amber-100 px-1 font-medium text-amber-900">${String(v)}</span>`
  })
}

export function DocumentRenderer({ templateId, data, personnelLabel, authorLabel, headerTemplate, bodyTemplate, footerTemplate }: Props) {
  // Якщо шаблон має кастомні header/body/footer (створені через Tiptap) — рендеримо їх
  if (headerTemplate || bodyTemplate || footerTemplate) {
    const d = (data as Record<string, unknown>) ?? {}
    const headerHtml = renderWithFields(headerTemplate ?? "", d)
    const bodyHtml = renderWithFields(bodyTemplate ?? "", d)
    const footerHtml = renderWithFields(footerTemplate ?? "", d)
    return (
      <div className="mx-auto max-w-[720px] bg-white p-8 text-[13px] leading-relaxed text-zinc-900" style={{ fontFamily: "Times New Roman, serif" }}>
        {headerHtml && <div className="mb-4 text-right text-[11px] leading-tight text-zinc-600" dangerouslySetInnerHTML={{ __html: headerHtml }} />}
        <div className="my-4 text-center text-[12px] font-semibold tracking-widest">РАПОРТ</div>
        {bodyHtml ? (
          <div className="document-preview-content prose prose-sm max-w-none text-justify" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
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
    <div className="mx-auto max-w-[720px] rounded-xl border bg-muted/20 p-6">
      <p className="text-sm font-medium">Попередній перегляд для {templateId} в розробці</p>
      <pre className="mt-3 overflow-auto rounded-lg bg-white p-3 text-xs">{JSON.stringify(data, null, 2)}</pre>
      {personnelLabel && <p className="mt-2 text-xs text-muted-foreground">Особовий склад: {personnelLabel}</p>}
    </div>
  )
}
