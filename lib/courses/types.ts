// Спільні типи курсів: серверні actions, admin-сторінка й майбутній пікер
// курсантів у редакторі працюють з одними й тими ж формами даних.
// Без "server-only" — типи потрібні і клієнтському менеджеру.

// Поля CourseRecord з Excel (колонки 1–37) — усі nullable, крім службових
export const COURSE_RECORD_TEXT_FIELDS = [
  "weaponNumber",
  "rank",
  "fullName",
  "unitNumber",
  "platoon",
  "position",
  "presence",
  "sick",
  "attentionGroup",
  "statusDate",
  "birthDate",
  "birthPlace",
  "conscribedBy",
  "taxId",
  "phone",
  "relativesPhone",
  "registrationAddress",
  "residenceAddress",
  "passport",
  "education",
  "drivingCategories",
  "maritalStatus",
  "workplace",
  "distinctiveFeatures",
  "debts",
  "convictions",
  "vlcConclusion",
  "serviceExperience",
  "combatExperience",
  "bloodType",
  "healthState",
  "healthComplaints",
  "allergies",
  "injuries",
  "militaryTicket",
  "ubdNumber",
] as const

export type CourseRecordTextField = (typeof COURSE_RECORD_TEXT_FIELDS)[number]

export type CourseRecordFields = {
  orderNumber: number | null
} & {
  [K in CourseRecordTextField]: string | null
}

export type CourseRecordData = {
  id: string
  courseId: string
  lastName: string | null
  firstName: string | null
  middleName: string | null
} & CourseRecordFields

export type CourseListItem = {
  id: string
  label: string
  fileName: string
  isActive: boolean
  createdAt: string
  recordCount: number
}

// Мапінг колонок Excel (1-based) на поля запису. Порядок відповідає шаблону
// таблиці особового складу (test.xlsx); дати — серіальні числа Excel.
export const EXCEL_COLUMN_FIELDS = {
  1: { field: "orderNumber", kind: "int" },
  2: { field: "weaponNumber", kind: "text" },
  3: { field: "rank", kind: "text" },
  4: { field: "fullName", kind: "text" },
  5: { field: "unitNumber", kind: "text" },
  6: { field: "platoon", kind: "text" },
  7: { field: "position", kind: "text" },
  8: { field: "presence", kind: "text" },
  9: { field: "sick", kind: "text" },
  10: { field: "attentionGroup", kind: "text" },
  11: { field: "statusDate", kind: "date" },
  12: { field: "birthDate", kind: "date" },
  13: { field: "birthPlace", kind: "text" },
  14: { field: "conscribedBy", kind: "text" },
  15: { field: "taxId", kind: "text" },
  16: { field: "phone", kind: "text" },
  17: { field: "relativesPhone", kind: "text" },
  18: { field: "registrationAddress", kind: "text" },
  19: { field: "residenceAddress", kind: "text" },
  20: { field: "passport", kind: "text" },
  21: { field: "education", kind: "text" },
  22: { field: "drivingCategories", kind: "text" },
  23: { field: "maritalStatus", kind: "text" },
  24: { field: "workplace", kind: "text" },
  25: { field: "distinctiveFeatures", kind: "text" },
  26: { field: "debts", kind: "text" },
  27: { field: "convictions", kind: "text" },
  28: { field: "vlcConclusion", kind: "text" },
  29: { field: "serviceExperience", kind: "text" },
  30: { field: "combatExperience", kind: "text" },
  31: { field: "bloodType", kind: "text" },
  32: { field: "healthState", kind: "text" },
  33: { field: "healthComplaints", kind: "text" },
  34: { field: "allergies", kind: "text" },
  35: { field: "injuries", kind: "text" },
  36: { field: "militaryTicket", kind: "text" },
  37: { field: "ubdNumber", kind: "text" },
} as const satisfies Record<
  number,
  { field: CourseRecordTextField | "orderNumber"; kind: "text" | "date" | "int" }
>

// Розбір ПІБ («АЛАДІН Вадим Андрійович») на частини для пікера й сортування
export function splitFullName(fullName: string | null): {
  lastName: string | null
  firstName: string | null
  middleName: string | null
} {
  if (!fullName) return { lastName: null, firstName: null, middleName: null }
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  return {
    lastName: parts[0] ?? null,
    firstName: parts[1] ?? null,
    middleName: parts.length > 2 ? parts.slice(2).join(" ") : null,
  }
}
