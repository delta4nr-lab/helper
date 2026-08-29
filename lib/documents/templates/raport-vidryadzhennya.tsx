import type { RaportVidryadzhennyaData } from "@/lib/documents/schemas/raport-vidryadzhennya"

type Props = {
  data: RaportVidryadzhennyaData
  personnelLabel?: string
  authorLabel?: string
  dateLabel?: string
}

export function RaportVidryadzhennyaTemplate({ data, personnelLabel, authorLabel, dateLabel }: Props) {
  const who = personnelLabel || "Військовослужбовець"
  const start = data.startDate ? new Date(data.startDate).toLocaleDateString("uk-UA") : "—"
  const end = data.endDate ? new Date(data.endDate).toLocaleDateString("uk-UA") : "—"

  // Розрахунок діб
  let days = "—"
  if (data.startDate && data.endDate) {
    const diff = Math.ceil((new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
    if (diff > 0) days = `${diff} діб`
  }

  return (
    <div className="mx-auto max-w-[720px] bg-white p-8 text-[13px] leading-relaxed text-zinc-900">
      <div className="text-right text-[11px] leading-tight text-zinc-500">
        Командиру військової частини А1234
        <br />
        полковнику ІВАНЕНКУ І.І.
        <br />
        {authorLabel ? `від ${authorLabel}` : ""}
      </div>

      <div className="mt-6 text-center text-[12px] font-semibold tracking-widest">РАПОРТ</div>

      <div className="mt-4 space-y-3">
        <p>
          Прошу Вашого клопотання щодо направлення мене у відрядження до{" "}
          <span className="rounded bg-amber-100 px-1 font-medium">{data.destination}</span> з{" "}
          <span className="rounded bg-amber-100 px-1">{start}</span> по{" "}
          <span className="rounded bg-amber-100 px-1">{end}</span> ({days}) з метою{" "}
          <span className="rounded bg-amber-100 px-1">{data.purpose}</span>.
        </p>
        <p>
          Транспорт: <span className="font-medium">{data.transport}</span>.
          {data.basis ? (
            <>
              {" "}
              Підстава: <span className="font-medium">{data.basis}</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 rounded-lg border border-dashed p-3 text-[11px]">
        <div>
          <div className="text-zinc-500">Військовослужбовець</div>
          <div className="font-medium">{who}</div>
          <div className="text-zinc-500 text-[10px]">звання / посада — з картки персоналії</div>
        </div>
        <div className="text-right">
          <div className="text-zinc-500">Дата складання</div>
          <div className="font-medium">{dateLabel || new Date().toLocaleDateString("uk-UA")}</div>
          <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
            Р-09 · {days}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t pt-3 text-[11px]">
        <span className="text-zinc-500">Підпис _________________</span>
        <span className="rounded border bg-zinc-50 px-2 py-1">А4 · відрядження</span>
      </div>
    </div>
  )
}
