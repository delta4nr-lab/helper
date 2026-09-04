"use server"

import ExcelJS from "exceljs"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { auth } from "@/auth"
import { db, orm } from "@/lib/db"
import {
  COURSE_RECORD_TEXT_FIELDS,
  EXCEL_COLUMN_FIELDS,
  splitFullName,
  type CourseRecordFields,
} from "@/lib/courses/types"

const MAX_IMPORT_SIZE = 15 * 1024 * 1024 // 15 МБ

async function requireAdmin() {
  const session = await (auth as unknown as () => Promise<{ user?: { id?: string; role?: string } } | null>)()
  return session?.user?.id && session.user.role === "ADMIN" ? session.user.id : null
}

function revalidateCourses() {
  revalidatePath("/admin/courses")
}

// ── Парсинг Excel ────────────────────────────────────────────────────────────

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30) // серіальні дати Excel (з урахуванням бага 1900-02-29)

function pad2(value: number): string {
  return String(value).padStart(2, "0")
}

function excelSerialToDateText(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0) return null
  const date = new Date(EXCEL_EPOCH_MS + Math.round(serial) * 86_400_000)
  return `${pad2(date.getUTCDate())}.${pad2(date.getUTCMonth() + 1)}.${date.getUTCFullYear()}`
}

function dateToText(value: ExcelJS.CellValue): string | null {
  if (value instanceof Date) {
    return `${pad2(value.getUTCDate())}.${pad2(value.getUTCMonth() + 1)}.${value.getUTCFullYear()}`
  }
  if (typeof value === "number") return excelSerialToDateText(value)
  return plainText(value)
}

function plainText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "object") {
    if ("richText" in value) {
      const rich = (value as { richText: Array<{ text: string }> }).richText
      const text = rich.map((part) => part.text).join("").replace(/\s+/g, " ").trim()
      return text === "" ? null : text
    }
    if ("result" in value) return plainText((value as { result: unknown }).result)
    if ("text" in value) return plainText((value as { text: unknown }).text)
    if ("error" in value) return null
    return null
  }
  const text = String(value).replace(/\r\n/g, "\n").trim()
  return text === "" ? null : text
}

function intCell(value: unknown): number | null {
  const text = plainText(value)
  if (text === null) return null
  const parsed = Number.parseInt(text, 10)
  return Number.isFinite(parsed) ? parsed : null
}

type CourseRecordDraft = CourseRecordFields & {
  lastName: string | null
  firstName: string | null
  middleName: string | null
}

function parseCourseSheet(worksheet: ExcelJS.Worksheet): CourseRecordDraft[] {
  const drafts: CourseRecordDraft[] = []
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber)
    const fullName = plainText(row.getCell(4).value)
    if (!fullName) continue // порожні рядки/розділювачі пропускаємо

    const draft: Record<string, string | number | null> = {}
    for (const [column, config] of Object.entries(EXCEL_COLUMN_FIELDS)) {
      const cellValue = row.getCell(Number(column)).value
      if (config.kind === "int") {
        draft[config.field] = intCell(cellValue)
      } else if (config.kind === "date") {
        draft[config.field] = dateToText(cellValue)
      } else {
        draft[config.field] = plainText(cellValue)
      }
    }
    drafts.push({ ...draft, ...splitFullName(fullName) } as unknown as CourseRecordDraft)
  }
  return drafts
}

// ── Server actions ───────────────────────────────────────────────────────────

export async function importCourseAction(
  formData: FormData
): Promise<{ ok: boolean; message: string }> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, message: "Недостатньо прав." }

  const label = String(formData.get("label") ?? "").trim()
  if (!label || label.length > 120) return { ok: false, message: "Вкажіть назву курсу (до 120 символів)." }

  const file = formData.get("file")
  if (!(file instanceof File)) return { ok: false, message: "Оберіть файл Excel (.xlsx)." }
  if (file.size === 0 || file.size > MAX_IMPORT_SIZE) {
    return { ok: false, message: "Файл порожній або завеликий (максимум 15 МБ)." }
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { ok: false, message: "Підтримуються лише файли .xlsx." }
  }

  let records: CourseRecordDraft[]
  try {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await file.arrayBuffer())
    const worksheet = workbook.worksheets[0]
    if (!worksheet) return { ok: false, message: "У файлі немає жодного аркуша." }
    records = parseCourseSheet(worksheet)
  } catch {
    return { ok: false, message: "Не вдалося прочитати файл Excel. Перевірте формат." }
  }
  if (records.length === 0) {
    return { ok: false, message: "У файлі не знайдено записів (очікуються дані з 2-го рядка з заповненим ПІБ)." }
  }

  try {
    await db.transaction(async (tx) => {
      const course = await tx.orm.public.Course.create({
        label,
        fileName: file.name,
        isActive: false,
      })
      for (const record of records) {
        await tx.orm.public.CourseRecord.create({ ...record, courseId: course.id })
      }
    })
  } catch (error) {
    console.error("[CourseImport] failed:", error)
    return { ok: false, message: "Не вдалося імпортувати курс. Спробуйте ще раз." }
  }

  revalidateCourses()
  return { ok: true, message: `Імпортовано курс «${label}»: ${records.length} записів.` }
}

export async function activateCourseAction(id: string): Promise<{ ok: boolean; message: string }> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, message: "Недостатньо прав." }

  try {
    await db.transaction(async (tx) => {
      const previous = await tx.orm.public.Course.select("id").where({ isActive: true }).all()
      for (const course of previous) {
        await tx.orm.public.Course.where({ id: course.id }).update({ isActive: false })
      }
      await tx.orm.public.Course.where({ id }).update({ isActive: true })
    })
  } catch {
    return { ok: false, message: "Не вдалося зробити курс активним." }
  }
  revalidateCourses()
  return { ok: true, message: "Курс зроблено активним." }
}

export async function renameCourseAction(
  id: string,
  label: string
): Promise<{ ok: boolean; message: string }> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, message: "Недостатньо прав." }

  const parsed = z.string().trim().min(1, "Вкажіть назву курсу.").max(120).safeParse(label)
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Некоректна назва." }

  try {
    await orm.Course.where({ id }).update({ label: parsed.data })
  } catch {
    return { ok: false, message: "Не вдалося перейменувати курс." }
  }
  revalidateCourses()
  return { ok: true, message: "Курс перейменовано." }
}

export async function deleteCourseAction(id: string): Promise<{ ok: boolean; message: string }> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, message: "Недостатньо прав." }

  try {
    await orm.Course.where({ id }).delete()
  } catch {
    return { ok: false, message: "Не вдалося видалити курс." }
  }
  revalidateCourses()
  return { ok: true, message: "Курс і всі його записи видалено." }
}

const courseRecordSchema = z.object({
  orderNumber: z.number().int().min(0).max(1_000_000).nullable().optional(),
  ...Object.fromEntries(
    COURSE_RECORD_TEXT_FIELDS.map((field) => [
      field,
      z.string().trim().max(4000).nullable().optional(),
    ])
  ),
} satisfies z.ZodRawShape)

export async function updateCourseRecordAction(
  id: string,
  input: unknown
): Promise<{ ok: boolean; message: string }> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, message: "Недостатньо прав." }

  const parsed = courseRecordSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Некоректні дані запису." }
  }

  // Оновлюємо лише передані поля — решта запису лишається як є.
  // Якщо змінено ПІБ — перераховуємо розбір на прізвище/імʼя/по батькові.
  const patch = Object.fromEntries(
    Object.entries(parsed.data).filter(([, value]) => value !== undefined)
  )
  if (Object.keys(patch).length === 0) return { ok: true, message: "Немає змін." }
  if (typeof patch.fullName === "string") {
    Object.assign(patch, splitFullName(patch.fullName))
  }

  try {
    await orm.CourseRecord.where({ id }).update(patch)
  } catch {
    return { ok: false, message: "Не вдалося зберегти запис." }
  }
  revalidateCourses()
  return { ok: true, message: "Запис збережено." }
}

export async function deleteCourseRecordAction(
  id: string
): Promise<{ ok: boolean; message: string }> {
  const adminId = await requireAdmin()
  if (!adminId) return { ok: false, message: "Недостатньо прав." }

  try {
    await orm.CourseRecord.where({ id }).delete()
  } catch {
    return { ok: false, message: "Не вдалося видалити запис." }
  }
  revalidateCourses()
  return { ok: true, message: "Запис видалено." }
}
