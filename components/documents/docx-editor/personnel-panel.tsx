"use client"

// Панель персоналу/курсантів (template-режим, панель праворуч від
// документа) — рестайл під стару «Панель готових полів» (порт 10985f0):
// згортання у вузьку рейку (PanelRightClose/Open), пошук за назвою поля,
// ТАБИ «Персонал» / «Курсанти» (з HEAD), степер екземпляра на кожній
// вкладці (instance / cadetInstance — окремі лічильники) і кнопки полів
// з іконками (Lucide) у стилі border + hover:border-primary/50
// hover:bg-muted/50.
// Вставка — FieldNode через публічний insertCustomNode (схема «nodes
// without a payload»: attrs → w:tag, lock: false — чіп редагований).
// Ідентичність поля — персонал: staff.{index}.{field}; курсанти:
// cadet.{index}.{field} (flavor живе в самому key — рушій розпізнає
// тільки acme:* теги). personnelId/зв'язок з конкретною людиною
// прив'язується пізніше через чіп-пікер (personnel-picker.tsx).

import * as React from "react"
import { insertCustomNode } from "@docx-editor.dev/pro"
import { useDocxEditor } from "@docx-editor.dev/react"
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
  Minus,
  PanelRightClose,
  PanelRightOpen,
  PenLine,
  Phone,
  Plus,
  Search,
  Shield,
  UserRound,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  placeCaretBesideField,
  suspendFieldSelect,
} from "@/components/documents/docx-editor/field-select"
import { FieldNode } from "@/lib/docx-editor/field-node"
import {
  COURSE_FIELD_LABELS,
  COURSE_RECORD_TEXT_FIELDS,
  type CourseRecordTextField,
} from "@/lib/courses/types"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export type PersonnelFieldType = "fullName" | "position" | "rank" | "signature"

export type PersonnelEntry = {
  id: string
  fullName: string
  rank: string
  position: string
  signaturePath: string | null
}

export const PERSONNEL_FIELD_LABELS: Record<PersonnelFieldType, string> = {
  fullName: "ПІБ",
  position: "Посада",
  rank: "Звання",
  signature: "Підпис",
}

// Іконки кнопок полів у панелі (старий стиль панелей довідників)
const FIELD_ICONS: Record<PersonnelFieldType, LucideIcon> = {
  fullName: UserRound,
  position: Briefcase,
  rank: Shield,
  signature: PenLine,
}

// Групи курсантських полів (порт field-catalogs 10985f0) — реальні групи
// довідника курсів: панель рендерить заголовки секцій за цією мапою.
type CadetFieldId = CourseRecordTextField | "orderNumber"

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

// Іконки курсантських полів (порт старої мапи; невідомі — Hash)
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

const CADET_FIELDS: readonly CadetFieldId[] = [...COURSE_RECORD_TEXT_FIELDS, "orderNumber"]

// Схема ідентичності персональних полів: буде прочитана майбутнім
// автозаповненням із attrs ноди (illy key у тезі FieldNode).
function getStaffTag(index: number, field: string): string {
  return `staff.${index}.${field}`
}

const INSERT_TOAST_ID = "personnel-insert"
const MAX_INSTANCE = 10
const LOG = "[personnel-panel]"

export function PersonnelPanel() {
  const editor = useDocxEditor()
  const [collapsed, setCollapsed] = React.useState(false)
  const [instance, setInstance] = React.useState(1)
  const [cadetInstance, setCadetInstance] = React.useState(1)
  const [search, setSearch] = React.useState("")

  const fields = Object.keys(PERSONNEL_FIELD_LABELS) as PersonnelFieldType[]
  const needle = search.trim().toLowerCase()

  // Видимі поля активної вкладки (пошук фільтрує обидва джерела)
  const visibleFields = needle
    ? fields.filter((fieldType) => PERSONNEL_FIELD_LABELS[fieldType].toLowerCase().includes(needle))
    : fields
  const visibleCadetFields = needle
    ? CADET_FIELDS.filter((fieldId) =>
        (COURSE_FIELD_LABELS[fieldId] ?? fieldId).toLowerCase().includes(needle)
      )
    : CADET_FIELDS
  const cadetGroups = React.useMemo(() => {
    const groups: Array<{ group: string; fields: CadetFieldId[] }> = []
    for (const fieldId of visibleCadetFields) {
      const group = CADET_FIELD_GROUPS[fieldId] ?? "Інше"
      // ПОРЯДКОВІ ПЕРЕРИВИ: поля однієї групи в COURSE_RECORD_TEXT_FIELDS не
      // йдуть підряд (militaryTicket/ubdNumber у кінці списку знову
      // «Контакти»), тому зливаємо в ПЕРШУ наявну секцію цієї групи —
      // група рендериться один раз → унікальний key={group}
      const existing = groups.find((entry) => entry.group === group)
      if (existing) existing.fields.push(fieldId)
      else groups.push({ group, fields: [fieldId] })
    }
    return groups
  }, [visibleCadetFields])

  async function insertField(fieldType: PersonnelFieldType) {
    if (!editor) return
    // Identity сповідного чіпа: один ключ (схема staff.{i}.{f}) в attrs →
    // w:tag; fieldType/personInstance виводяться з key у fromDocx. Тег
    // короткий (≤ 64 перевірено) — переповнення неможливе.
    const attrs = { key: getStaffTag(instance, fieldType) }
    const label = `${PERSONNEL_FIELD_LABELS[fieldType]} (${instance})`
    // Маркер місця підпису в шаблоні — чіп видимый («Підпис (N)»); при
    // прив'язці людини текст переписується на пробіл у вмісті документа
    // (bindPerson), а картинка стає праворуч від чіпа.
    // Авто-виділення FieldSelect призупинено на час вставки+розміщення —
    // той самий патерн, що й у field-insert-dialog.
    suspendFieldSelect(true)
    const ok = await insertNodeIntoDocument(attrs, label)
    if (!ok) return
    // Каретка одразу за нодою — той самий рушійний шлях, що й у field-insert-dialog.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        void placeCaretBesideField(editor).finally(() => suspendFieldSelect(false))
      })
    )
  }

  // Спільна вставка FieldNode (чекання FieldSelect, каретка лишається в
  // редакторі): повертає результат для подальшого розміщення каретки.
  async function insertNodeIntoDocument(
    attrs: { key: string; f?: string; i?: string },
    label: string
  ): Promise<boolean> {
    if (!editor) return false
    // Виділений текст замінюється нодою: insertCustomNode вставляє в точку
    // head виділення без видалення, тому спершу очищаємо виділення
    // публічною командою paste { text: "" } («at the selection, replacing
    // it» — payload аргументом, системний буфер не чіпається); відмова →
    // fallback cut («delete it», мінус — текст іде в буфер обміну).
    const snapshot = editor.snapshot()
    if (!snapshot.selectionCollapsed) {
      let cleared = editor.exec({ type: "paste", text: "" })
      if (!cleared.ok) {
        cleared = editor.exec({ type: "cut" })
      }
      if (!cleared.ok) {
        console.warn(LOG, "не вдалося очистити виділення перед вставкою поля →", {
          code: cleared.code,
          reason: cleared.reason,
        })
      }
    }
    const result = insertCustomNode(editor, FieldNode, {
      attrs,
      text: label,
      alias: label,
      lock: false,
    })
    if (!result.ok) {
      suspendFieldSelect(false)
      toast.error(result.reason ?? "Не вдалося вставити поле.")
      return false
    }
    toast.success(`Поле «${label}» вставлено.`, { id: INSERT_TOAST_ID })
    return true
  }

  // Вставка курсантського поля (порт insertCadetField з fbcf076): офіційні
  // ідентифікації key/f/i в attrs → w:tag — cadet.{i}.{f}; значення з
  // АКТИВНОГО курсу підставляється при прив'язці курсанта (p = record.id).
  async function insertCadetField(field: CadetFieldId) {
    if (!editor) return
    const attrs = {
      key: `cadet.${cadetInstance}.${field}`,
      f: field,
      i: String(cadetInstance),
    }
    const label = `${COURSE_FIELD_LABELS[field] ?? field} (${cadetInstance})`
    // Авто-виділення FieldSelect призупинено на час вставки+розміщення.
    suspendFieldSelect(true)
    const ok = await insertNodeIntoDocument(attrs, label)
    if (!ok) return
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        void placeCaretBesideField(editor).finally(() => suspendFieldSelect(false))
      })
    )
  }

  // Згорнута панель → вузька рейка з кнопкою розгортання (старий патерн
  // панелей довідників: не займає місце поруч з іншими панелями)
  if (collapsed) {
    return (
      <aside className="flex w-9 shrink-0 flex-col items-center border-l border-border/50 bg-card py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(false)}
          title="Показати поля персоналу та курсантів"
          aria-label="Показати панель персоналу"
        >
          <PanelRightOpen className="size-4" />
        </Button>
      </aside>
    )
  }

  // Степер екземпляра вкладки (спільна разметка для обох табів)
  const stepper = (
    instanceNo: number,
    setInstanceNo: React.Dispatch<React.SetStateAction<number>>,
    hint: string
  ) => (
    <div className="flex items-center justify-between gap-1 rounded-md border border-border px-1 py-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Попередній екземпляр"
        disabled={instanceNo <= 1}
        onClick={() => setInstanceNo((v) => Math.max(1, v - 1))}
      >
        <Minus className="size-4" />
      </Button>
      <span
        className={cn("text-sm font-medium tabular-nums", !editor && "text-muted-foreground")}
        title={hint}
      >
        {instanceNo}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Наступний екземпляр"
        disabled={instanceNo >= MAX_INSTANCE}
        onClick={() => setInstanceNo((v) => Math.min(MAX_INSTANCE, v + 1))}
      >
        <Plus className="size-4" />
      </Button>
    </div>
  )

  return (
    <aside className="flex w-56 shrink-0 flex-col overflow-hidden border-l border-border/50 bg-card">
      <div className="flex items-center justify-between gap-1 border-b border-border/50 px-2.5 py-2">
        <span className="truncate text-sm font-semibold">Поля</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setCollapsed(true)}
          title="Згорнути панель"
          aria-label="Згорнути панель персоналу"
        >
          <PanelRightClose className="size-4" />
        </Button>
      </div>

      {/* Пошук спільний: фільтрує поля активної вкладки */}
      <div className="border-b border-border/50 px-2 py-2">
        <div className="relative">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Пошук поля"
            className="h-8 pr-8"
          />
          <Search className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {/* Таби джерел: сегментований контроль (variant default) — активна
          вкладка = контрастна «пігулка» із тінню + іконка джерела */}
      <Tabs defaultValue="personnel" className="flex min-h-0 flex-1 flex-col">
        <TabsList variant="default" className="w-full shrink-0">
          <TabsTrigger value="personnel" className="flex-1">
            <UserRound data-icon="inline-start" />
            Персонал
          </TabsTrigger>
          <TabsTrigger value="cadets" className="flex-1">
            <GraduationCap data-icon="inline-start" />
            Курсанти
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personnel" className="mt-0 flex min-h-0 flex-1 flex-col gap-1.5 p-2">
          {stepper(instance, setInstance, "Поля вставляться для людини з цим номером")}

          {visibleFields.map((fieldType) => {
            const Icon = FIELD_ICONS[fieldType]
            const label = PERSONNEL_FIELD_LABELS[fieldType]
            return (
              <button
                key={fieldType}
                type="button"
                disabled={!editor}
                onClick={() => void insertField(fieldType)}
                // Каретка редактора має лишитися на місці: не віддаємо фокус кнопці
                onMouseDown={(event) => event.preventDefault()}
                className="flex w-full items-center gap-2 rounded-md border border-border px-2 py-1.5 text-left text-sm transition-colors hover:border-primary/50 hover:bg-muted/50 disabled:opacity-50"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{`${label} (${instance})`}</span>
              </button>
            )
          })}
          {visibleFields.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">Не знайдено.</p>
          )}

          <p className="mt-1 px-1 text-xs text-muted-foreground">
            Вставлені поля людини №{instance} прив&apos;язуються до працівника кнопкою на чіпі в
            документі.
          </p>
        </TabsContent>

        <TabsContent value="cadets" className="mt-0 flex min-h-0 flex-col gap-1.5 p-2">
          {stepper(cadetInstance, setCadetInstance, "Поля вставляться для курсанта з цим номером")}

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {cadetGroups.map(({ group, fields: groupFields }) => (
              <div key={group}>
                <h4 className="px-1 pt-2 pb-1 text-xs font-medium text-muted-foreground">{group}</h4>
                <div className="flex flex-col gap-1">
                  {groupFields.map((fieldId) => {
                    const Icon = CADET_FIELD_ICONS[fieldId] ?? Hash
                    const label = COURSE_FIELD_LABELS[fieldId] ?? fieldId
                    return (
                      <button
                        key={fieldId}
                        type="button"
                        disabled={!editor}
                        onClick={() => void insertCadetField(fieldId)}
                        onMouseDown={(event) => event.preventDefault()}
                        className="flex w-full items-center gap-2 rounded-md border border-border px-2 py-1.5 text-left text-sm transition-colors hover:border-primary/50 hover:bg-muted/50 disabled:opacity-50"
                      >
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
            {cadetGroups.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">Не знайдено.</p>
            )}
          </div>

          <p className="px-1 text-xs text-muted-foreground">
            Прив&apos;язка курсанта з активного курсу — кнопкою на чіпі в документі.
          </p>
        </TabsContent>
      </Tabs>
    </aside>
  )
}
