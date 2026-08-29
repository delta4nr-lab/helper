import { z } from "zod"

// Рапорт на відрядження (Р-09) — єдиний рапорт у фундаменті
// 7 полів: персонал, місце, мета, дати, транспорт, підстава

export const raportVidryadzhennyaSchema = z
  .object({
    personnelId: z.string().cuid().optional().or(z.literal("")),
    destination: z.string().trim().min(2, "Вкажіть місце відрядження").max(128, "Максимум 128 символів"),
    purpose: z.string().trim().min(5, "Вкажіть мету відрядження").max(512, "Максимум 512 символів"),
    startDate: z.string().min(1, "Вкажіть дату початку").refine((v) => !isNaN(Date.parse(v)), "Невірний формат дати"),
    endDate: z.string().min(1, "Вкажіть дату закінчення").refine((v) => !isNaN(Date.parse(v)), "Невірний формат дати"),
    transport: z.enum(["авто", "потяг", "літак", "автобус", "інше"], { message: "Оберіть транспорт" }),
    basis: z.string().trim().max(512).optional(),
  })
  .refine((d) => new Date(d.endDate) >= new Date(d.startDate), {
    message: "Дата закінчення не може бути раніше початку",
    path: ["endDate"],
  })

export type RaportVidryadzhennyaData = z.infer<typeof raportVidryadzhennyaSchema>

export function raportVidryadzhennyaTitle(data: Partial<RaportVidryadzhennyaData>, personnelLabel?: string) {
  const who = personnelLabel || "Військовослужбовець"
  const city = data.destination || ""
  const from = data.startDate ? new Date(data.startDate).toLocaleDateString("uk-UA") : ""
  return `Рапорт на відрядження — ${who}${city ? ` до ${city}` : ""}${from ? ` з ${from}` : ""}`
}

export const raportVidryadzhennyaFieldDefs = [
  { key: "personnelId", label: "Особовий склад", type: "personnel", required: false, placeholder: "Оберіть зі списку" },
  { key: "destination", label: "Місце відрядження", type: "text", required: true, placeholder: "м. Київ, в/ч А0000" },
  { key: "purpose", label: "Мета відрядження", type: "textarea", required: true, placeholder: "Участь у навчаннях..." },
  { key: "startDate", label: "Дата початку", type: "date", required: true },
  { key: "endDate", label: "Дата закінчення", type: "date", required: true },
  { key: "transport", label: "Транспорт", type: "select", required: true, options: ["авто", "потяг", "літак", "автобус", "інше"] },
  { key: "basis", label: "Підстава", type: "textarea", required: false, placeholder: "Наказ командира №..." },
] as const
