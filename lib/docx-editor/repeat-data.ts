// Джерело даних для repeat-рядків: БД-записи у вже наявному deterministic
// порядку. Тут немає жодного React/engine — чисті маппери.
//
//   dataSource "personnel"        → Personnel (props, порядок lastName.asc);
//   dataSource "course"           → активний CourseRecord (порядок lastName, firstName);
//   dataSource "medicalReferral"  → MedicalReferral (порядок createdAt/referralDate).
//
// Повертає лише entityId — identity DB-запису, який займає рядок. Значення
// полів у чіпи не підставляються (користувач прив'язує/заповнює сам).

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
    return ctx.personnel.map((person) => ({ entityId: person.id }))
  }

  if (dataSource === "course") {
    return ctx.cadets.map((cadet) => ({ entityId: cadet.id }))
  }

  // medicalReferral: кожен запис — окремий рядок (два направлення одного
  // курсанта = два рядки).
  return ctx.referrals.map((referral) => ({ entityId: referral.id }))
}
