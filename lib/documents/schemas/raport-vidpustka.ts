import { z } from "zod"

// Рапорт на відпустку (Р-01) — єдиний рапорт у фундаменті, нейтральні ключі для перевикористання
// Ключі нейтральні: documentNumber/documentDate/startDate/durationDays/location тощо — підходять для nakaz/dopovid

export const raportVidpustkaSchema = z.object({
  // Персоналія — вибір з БД (нейтрально)
  personnelId: z.string().cuid().optional().or(z.literal("")),

  // Унікальні нейтральні поля (validation зберігається в TemplateField.validation Json)
  documentType: z.enum(["щорічна", "соціальна", "за сімейними обставинами", "навчальна", "для лікування після поранення"], {
    message: "Оберіть тип відпустки",
  }),
  startDate: z
    .string()
    .min(1, "Вкажіть дату початку")
    .refine((v) => !isNaN(Date.parse(v)), "Невірний формат дати"),
  durationDays: z.coerce
    .number({ message: "Вкажіть кількість діб" })
    .int("Тільки ціле число")
    .min(1, "Мінімум 1 доба")
    .max(90, "Максимум 90 діб"),
  location: z.string().trim().min(2, "Вкажіть місце проведення").max(256, "Максимум 256 символів"),
  documentNumber: z.string().trim().min(2, "Вкажіть номер документа").max(64).optional().or(z.literal("")),
  documentDate: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || !isNaN(Date.parse(v)), "Невірний формат дати"),
  contactPhone: z
    .string()
    .trim()
    .max(32)
    .optional()
    .or(z.literal("")),
  basis: z.string().trim().max(1024).optional().or(z.literal("")),
})

export type RaportVidpustkaData = z.infer<typeof raportVidpustkaSchema>

export function raportVidpustkaTitle(data: Partial<RaportVidpustkaData>, personnelLabel?: string) {
  const who = personnelLabel || "Військовослужбовець"
  const when = data.startDate ? new Date(data.startDate).toLocaleDateString("uk-UA") : ""
  return `Рапорт на відпустку — ${who}${when ? ` з ${when}` : ""}`
}

// Нейтральні дефініції — key унікальний в межах шаблону, label українською, type нейтральний
export const raportVidpustkaFieldDefs = [
  { key: "personnelId", label: "Особовий склад", type: "personnel", required: false, placeholder: "Оберіть зі списку" },
  { key: "documentType", label: "Тип відпустки", type: "select", required: true, options: ["щорічна", "соціальна", "за сімейними обставинами", "навчальна", "для лікування після поранення"] },
  { key: "startDate", label: "Дата початку", type: "date", required: true },
  { key: "durationDays", label: "Тривалість (діб)", type: "number", required: true, placeholder: "15" },
  { key: "location", label: "Місце проведення", type: "text", required: true, placeholder: "м. Львів, вул. ..." },
  { key: "documentNumber", label: "Номер документа-підстави", type: "text", required: false, placeholder: "2026-0724-1157-2892-7" },
  { key: "documentDate", label: "Дата документа-підстави", type: "date", required: false },
  { key: "contactPhone", label: "Контактний телефон", type: "text", required: false, placeholder: "(050) 1234567" },
  { key: "basis", label: "Підстава / примітка", type: "textarea", required: false, placeholder: "Рішення ВЛК, наказ..." },
] as const
