import type { RaportVidpustkaData } from "@/lib/documents/schemas/raport-vidpustka"

type Props = {
  data: RaportVidpustkaData
  personnelLabel?: string
  authorLabel?: string
  dateLabel?: string
}

// Чистий шаблон — без бізнес-логіки, тільки рендер (AGENTS: Template → Renderer)
// Нейтральні ключі: startDate/durationDays/location/documentNumber/documentDate/basis — перевикористовуються в nakaz/dopovid
export function RaportVidpustkaTemplate({ data, personnelLabel, authorLabel, dateLabel }: Props) {
  const who = personnelLabel || "Військовослужбовець"
  const start = data.startDate ? new Date(data.startDate).toLocaleDateString("uk-UA") : "—"
  const docDate = data.documentDate ? new Date(data.documentDate).toLocaleDateString("uk-UA") : ""
  const type = data.documentType || "щорічна"

  return (
    <div className="mx-auto max-w-[720px] bg-white p-8 text-[13px] leading-relaxed text-zinc-900">
      <div className="text-right text-[11px] leading-tight text-zinc-500">
        Командиру військової частини А1890
        <br />
        полковнику ФАСІЮ Д.В.
        <br />
        {authorLabel ? `від ${authorLabel}` : ""}
      </div>

      <div className="mt-6 text-center text-[12px] font-semibold tracking-widest">РАПОРТ</div>

      <div className="mt-4 space-y-3">
        <p className="text-justify">
          Прошу Вашого клопотання перед вищим командуванням щодо надання мені <span className="font-medium">{type}</span> відпустки з{" "}
          <span className="rounded bg-amber-100 px-1">{start}</span> тривалістю{" "}
          <span className="rounded bg-amber-100 px-1">{data.durationDays} діб</span> з виїздом до{" "}
          <span className="rounded bg-amber-100 px-1">{data.location}</span>.
        </p>
        {(data.documentNumber || docDate) && (
          <p className="text-zinc-700">
            Підстава: <span className="font-medium">документ № {data.documentNumber || "—"}</span> від{" "}
            <span className="font-medium">{docDate || "—"}</span>
            {data.basis ? ` — ${data.basis}` : ""}.
          </p>
        )}
        {!data.documentNumber && data.basis && (
          <p className="text-zinc-700">
            Підстава: <span className="font-medium">{data.basis}</span>
          </p>
        )}
        {data.contactPhone && (
          <p className="text-xs text-zinc-600">Контакт: {data.contactPhone} (нейтральне поле, доступне в nakaz/dopovid)</p>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 rounded-lg border border-dashed p-3 text-[11px]">
        <div>
          <div className="text-zinc-500">Військовослужбовець</div>
          <div className="font-medium">{who}</div>
        </div>
        <div className="text-right">
          <div className="text-zinc-500">Дата</div>
          <div className="font-medium">{dateLabel || new Date().toLocaleDateString("uk-UA")}</div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t pt-3 text-[11px]">
        <span className="text-zinc-500">Підпис _________________</span>
        <span className="rounded border bg-zinc-50 px-2 py-1">Р-01 · А4 · нейтральні поля</span>
      </div>
    </div>
  )
}
