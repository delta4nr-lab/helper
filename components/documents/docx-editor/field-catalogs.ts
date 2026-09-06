// Довідники готових полів для панелі адміна (права колонка редактора шаблона).
// ОДНА система Document Fields, різні ДЖЕРЕЛА даних (source):
// - "personnel" — довідник ПЕРСОНАЛУ, теги staff.{index}.{field};
// - "cadet" — КУРСАНТИ з активного курсу (CourseRecord), теги cadet.{index}.{field}.
// Розширення = новий запис у FIELD_CATALOGS: панель рендерить таби, заголовки,
// секції та кнопки з даних, без змін коду.
//
// Номерні довідники (numbered): панель показує лічильник записів (людей),
// тег і назва поля будуються з індексом — staff.1.fullName, «Звання (2)».
// Заповнення потім підставляє дані строго потрібного запису за індексом у тезі.

import {
  Briefcase,
  CalendarDays,
  Car,
  CreditCard,
  FileText,
  GraduationCap,
  Hash,
  HeartPulse,
  Home,
  MapPin,
  PenLine,
  Phone,
  Shield,
  UserRound,
  type LucideIcon,
} from "lucide-react"

import type { InsertableContentControlType } from "@docx-editor.dev/core/contracts/editor"
import { COURSE_FIELD_LABELS } from "@/lib/courses/types"

export type FieldSource = "personnel" | "cadet"

export type CatalogField = {
  id: string
  /** Людська назва поля — кнопка в панелі; для неномерних — alias контрола. */
  label: string
  /** Статичний тег контрола (w:tag) для неномерних довідників; номерні
      будують тег через getStaffTag/getCadetTag у момент вставки. */
  tag?: string
  /** subtype команди insertContentControl. */
  subtype: InsertableContentControlType
  icon: LucideIcon
  /** Група полів у панелі (реальні групи довідника). */
  group?: string
}

export type FieldCatalog = {
  id: string
  /** Джерело даних для автозаповнення. */
  source: FieldSource
  /** Заголовок панелі/секції довідника. */
  title: string
  /** Коротка назва таба (коли панель показує кілька довідників). */
  tabLabel?: string
  /** Підказка внизу секції (необов'язкова). */
  hint?: string
  /** Номерний довідник: лічильник записів на панелі, тег/назва з індексом. */
  numbered?: boolean
  /** Максимум лічильника (для numbered). */
  maxIndex?: number
  fields: readonly CatalogField[]
}

// ── КУРСАНТИ: 37 полів CourseRecord (активний курс), групи — реальні групи
// довідника курсів (course-manager). Назви — з COURSE_FIELD_LABELS.

const CADET_FIELD_IDS = [
  // Основне
  "orderNumber",
  "rank",
  "fullName",
  "unitNumber",
  "platoon",
  "position",
  "weaponNumber",
  "presence",
  "sick",
  "attentionGroup",
  "statusDate",
  // Контакти та документи
  "phone",
  "relativesPhone",
  "taxId",
  "passport",
  "militaryTicket",
  "ubdNumber",
  // Адреси
  "registrationAddress",
  "residenceAddress",
  // Особисті дані
  "birthDate",
  "birthPlace",
  "conscribedBy",
  "education",
  "drivingCategories",
  "maritalStatus",
  "workplace",
  // Здоровʼя та служба
  "bloodType",
  "healthState",
  "healthComplaints",
  "allergies",
  "injuries",
  "vlcConclusion",
  "serviceExperience",
  "combatExperience",
  "distinctiveFeatures",
  "debts",
  "convictions",
] as const

type CadetFieldId = (typeof CADET_FIELD_IDS)[number]

const CADET_FIELD_GROUPS: Record<CadetFieldId, string> = {
  orderNumber: "Основне",
  rank: "Основне",
  fullName: "Основне",
  unitNumber: "Основне",
  platoon: "Основне",
  position: "Основне",
  weaponNumber: "Основне",
  presence: "Основне",
  sick: "Основне",
  attentionGroup: "Основне",
  statusDate: "Основне",
  phone: "Контакти та документи",
  relativesPhone: "Контакти та документи",
  taxId: "Контакти та документи",
  passport: "Контакти та документи",
  militaryTicket: "Контакти та документи",
  ubdNumber: "Контакти та документи",
  registrationAddress: "Адреси",
  residenceAddress: "Адреси",
  birthDate: "Особисті дані",
  birthPlace: "Особисті дані",
  conscribedBy: "Особисті дані",
  education: "Особисті дані",
  drivingCategories: "Особисті дані",
  maritalStatus: "Особисті дані",
  workplace: "Особисті дані",
  bloodType: "Здоровʼя та служба",
  healthState: "Здоровʼя та служба",
  healthComplaints: "Здоровʼя та служба",
  allergies: "Здоровʼя та служба",
  injuries: "Здоровʼя та служба",
  vlcConclusion: "Здоровʼя та служба",
  serviceExperience: "Здоровʼя та служба",
  combatExperience: "Здоровʼя та служба",
  distinctiveFeatures: "Здоровʼя та служба",
  debts: "Здоровʼя та служба",
  convictions: "Здоровʼя та служба",
}

const CADET_FIELD_ICONS: Partial<Record<CadetFieldId, LucideIcon>> = {
  fullName: UserRound,
  rank: Shield,
  position: Briefcase,
  orderNumber: Hash,
  platoon: Hash,
  unitNumber: Hash,
  weaponNumber: Hash,
  phone: Phone,
  relativesPhone: Phone,
  taxId: CreditCard,
  passport: FileText,
  militaryTicket: FileText,
  ubdNumber: FileText,
  birthDate: CalendarDays,
  statusDate: CalendarDays,
  birthPlace: MapPin,
  registrationAddress: Home,
  residenceAddress: Home,
  education: GraduationCap,
  drivingCategories: Car,
  bloodType: HeartPulse,
  healthState: HeartPulse,
  healthComplaints: HeartPulse,
  allergies: HeartPulse,
  injuries: HeartPulse,
  vlcConclusion: HeartPulse,
  workplace: Briefcase,
}

const CADET_FIELD_LIST: readonly CatalogField[] = CADET_FIELD_IDS.map((id) => ({
  id,
  label: COURSE_FIELD_LABELS[id as CadetFieldId],
  subtype: "plainText" as const,
  group: CADET_FIELD_GROUPS[id],
  icon: CADET_FIELD_ICONS[id] ?? Hash,
}))

// Поля курсанта для циклів заповнення/скидання (текст + № п/п)
export const CADET_FILL_FIELDS: readonly CadetFieldId[] = CADET_FIELD_IDS

export const FIELD_CATALOGS: readonly FieldCatalog[] = [
  {
    id: "personnel",
    source: "personnel",
    title: "Поля персоналу",
    tabLabel: "Персонал",
    hint: "Підпис вставляється як поле — зображення підставиться під час заповнення.",
    numbered: true,
    maxIndex: 5,
    fields: [
      { id: "fullName", label: "ПІБ", subtype: "plainText", icon: UserRound },
      { id: "position", label: "Посада", subtype: "plainText", icon: Briefcase },
      { id: "rank", label: "Звання", subtype: "plainText", icon: Shield },
      // Підпис: движок не вміє створювати picture-SDT, тому поки plainText.
      // Тег staff.signature — позначка типу; зображення підставить логіка
      // заповнення (fill-panel вміє ставити підписи).
      { id: "signature", label: "Підпис", subtype: "plainText", icon: PenLine },
    ],
  },
  {
    id: "cadets",
    source: "cadet",
    title: "Поля курсантів",
    tabLabel: "Курсанти",
    hint: "Автозаповнення — вибір курсанта з активного курсу.",
    numbered: true,
    maxIndex: 50,
    fields: CADET_FIELD_LIST,
  },
]

// ПЕРСОНАЛ: тег поля з індексом людини: staff.1.fullName, staff.2.position…
export function getStaffTag(index: number, field: string): string {
  return `staff.${index}.${field}`
}

// Зворотний розбір тега персоналу — для заповнення за індексом.
export function parseStaffTag(tag: string): { index: number; field: string } | null {
  const match = tag.match(/^staff\.(\d+)\.([a-zA-Z][a-zA-Z0-9_]*)$/)
  return match ? { index: Number(match[1]), field: match[2] } : null
}

// КУРСАНТИ: тег поля з індексом курсанта: cadet.1.fullName, cadet.2.rank…
export function getCadetTag(index: number, field: string): string {
  return `cadet.${index}.${field}`
}

// Зворотний розбір тега курсанта — для заповнення за індексом.
export function parseCadetTag(tag: string): { index: number; field: string } | null {
  const match = tag.match(/^cadet\.(\d+)\.([a-zA-Z][a-zA-Z0-9_]*)$/)
  return match ? { index: Number(match[1]), field: match[2] } : null
}

// Назва поля номерного довідника: «ПІБ (2)».
export function getNumberedFieldTitle(label: string, index: number): string {
  return `${label} (${index})`
}
