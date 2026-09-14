// Джерело даних для repeat-рядків: БД-записи у вже наявному deterministic
// порядку. Тут немає жодного React/engine — чисті маппери.
//
//   dataSource "personnel"        → Personnel (props, порядок lastName.asc);
//   dataSource "course"           → активний CourseRecord (порядок lastName, firstName);
//   dataSource "medicalReferral"  → MedicalReferral (порядок createdAt/referralDate).
//
// Повертає entityId (identity рядка) і мапу значень полів (для майбутнього
// використання); дублювання зараз підставляє лише плейсхолдери-назви полів.

import type { RepeatDataSource } from "@/lib/docx-editor/repeat-row"
import type { PersonnelEntry } from "@/components/documents/docx-editor/personnel-panel"
import type { CourseRecordData } from "@/lib/courses/types"

// Мінімальний профіль направлення (узгоджений із моделлю MedicalReferral).
export type MedicalReferralRow = {
  id: string
  courseRecordId: string
  facility: string | null
  referralDate: string | null
}

export type RepeatSourceContext = {
  readonly personnel: readonly PersonnelEntry[]
  readonly cadets: readonly CourseRecordData[]
  readonly referrals: readonly MedicalReferralRow[]
}

export type RepeatDataRow = {
  readonly entityId: string
  readonly values: Record<string, string>
}

// dataKey для staff: поля PersonnelEntry.
function staffValues(person: PersonnelEntry): Record<string, string> {
  return {
    fullName: person.fullName,
    position: person.position,
    rank: person.rank,
  }
}

// dataKey для cadet: усі текстові колонки CourseRecordData.
function cadetValues(cadet: CourseRecordData): Record<string, string> {
  const values: Record<string, string> = {}
  for (const [key, raw] of Object.entries(cadet as unknown as Record<string, unknown>)) {
    if (typeof raw === "string") values[key] = raw
    else if (typeof raw === "number") values[key] = String(raw)
  }
  return values
}

// dataKey для referral: поля MedicalReferral.
function referralValues(referral: MedicalReferralRow): Record<string, string> {
  return {
    facility: referral.facility ?? "",
    referralDate: referral.referralDate ?? "",
  }
}

/**
 * Усі кандидати для repeat-групи у стабільному порядку наявних запитів.
 * Порожні записи не фільтруємо: порядок і кількість визначають рядки.
 */
export function listRepeatRows(
  dataSource: RepeatDataSource,
  ctx: RepeatSourceContext
): RepeatDataRow[] {
  if (dataSource === "personnel") {
    return ctx.personnel.map((person) => ({
      entityId: person.id,
      values: staffValues(person),
    }))
  }

  if (dataSource === "course") {
    return ctx.cadets.map((cadet) => ({
      entityId: cadet.id,
      values: cadetValues(cadet),
    }))
  }

  // medicalReferral: кожен запис — окремий рядок (два направлення одного
  // курсанта = два рядки).
  return ctx.referrals.map((referral) => ({
    entityId: referral.id,
    values: referralValues(referral),
  }))
}
