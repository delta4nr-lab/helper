"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, Pencil, Search, Star, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  activateCourseAction,
  deleteCourseAction,
  deleteCourseRecordAction,
  importCourseAction,
  renameCourseAction,
  updateCourseRecordAction,
} from "@/lib/courses/actions"
import {
  COURSE_RECORD_TEXT_FIELDS,
  type CourseListItem,
  type CourseRecordData,
  type CourseRecordTextField,
} from "@/lib/courses/types"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

// Діалог редагування: усі 37 полів по секціях
const EDIT_SECTIONS: Array<{ title: string; fields: Array<{ name: CourseRecordTextField; label: string }> }> = [
  {
    title: "Основне",
    fields: [
      { name: "rank", label: "Звання" },
      { name: "unitNumber", label: "№ частини" },
      { name: "platoon", label: "№ взводу" },
      { name: "position", label: "Посада" },
      { name: "weaponNumber", label: "№ зброї" },
      { name: "presence", label: "Наявність (у строю)" },
      { name: "sick", label: "Хворі" },
      { name: "attentionGroup", label: "Група посиленої уваги" },
      { name: "statusDate", label: "Дата статусу" },
    ],
  },
  {
    title: "Контакти та документи",
    fields: [
      { name: "phone", label: "№ телефону" },
      { name: "relativesPhone", label: "№ телефону близьких" },
      { name: "taxId", label: "ІПН" },
      { name: "passport", label: "№ та серія паспорту" },
      { name: "militaryTicket", label: "№ військового квитка" },
      { name: "ubdNumber", label: "№ УБД" },
    ],
  },
  {
    title: "Адреси",
    fields: [
      { name: "registrationAddress", label: "Місце прописки" },
      { name: "residenceAddress", label: "Місце проживання" },
    ],
  },
  {
    title: "Особисті дані",
    fields: [
      { name: "birthDate", label: "Дата народження" },
      { name: "birthPlace", label: "Місце народження" },
      { name: "conscribedBy", label: "Ким призваний ТЦК" },
      { name: "education", label: "Освіта" },
      { name: "drivingCategories", label: "Водійські категорії" },
      { name: "maritalStatus", label: "Сімейний стан" },
      { name: "workplace", label: "Місце роботи" },
    ],
  },
  {
    title: "Здоровʼя та служба",
    fields: [
      { name: "bloodType", label: "Група крові" },
      { name: "healthState", label: "Загальний стан здоровʼя" },
      { name: "healthComplaints", label: "Скарги на стан здоровʼя" },
      { name: "allergies", label: "Алергічні реакції" },
      { name: "injuries", label: "Перенесені травми" },
      { name: "vlcConclusion", label: "Висновок ВЛК" },
      { name: "serviceExperience", label: "Попередній досвід ВС" },
      { name: "combatExperience", label: "Досвід участі в БД" },
      { name: "distinctiveFeatures", label: "Особливі прикмети" },
      { name: "debts", label: "Борги" },
      { name: "convictions", label: "Судимості / адміністративні" },
    ],
  },
]

type EditState = {
  orderNumber: string
  texts: Record<CourseRecordTextField, string>
}

export function CourseManager({
  courses,
  selectedId,
  records,
}: {
  courses: CourseListItem[]
  selectedId: string | null
  records: CourseRecordData[]
}) {
  const router = useRouter()
  const [importLabel, setImportLabel] = React.useState(() => new Date().toLocaleDateString("uk-UA"))
  const [importFile, setImportFile] = React.useState<File | null>(null)
  const [importing, setImporting] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const [editRecord, setEditRecord] = React.useState<CourseRecordData | null>(null)
  const [editState, setEditState] = React.useState<EditState | null>(null)
  const [renameCourse, setRenameCourse] = React.useState<CourseListItem | null>(null)
  const [renameLabel, setRenameLabel] = React.useState("")
  const [confirmDeleteCourseId, setConfirmDeleteCourseId] = React.useState<string | null>(null)
  const [confirmDeleteRecordId, setConfirmDeleteRecordId] = React.useState<string | null>(null)

  const selectedCourse = courses.find((course) => course.id === selectedId) ?? null

  const filteredRecords = React.useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return records
    return records.filter((record) =>
      [record.fullName, record.lastName, record.firstName, record.rank, record.position, record.weaponNumber]
        .some((value) => (value ?? "").toLowerCase().includes(needle))
    )
  }, [records, search])

  async function handleImport() {
    if (!importFile || importing) return
    setImporting(true)
    const formData = new FormData()
    formData.set("label", importLabel)
    formData.set("file", importFile)
    const result = await importCourseAction(formData)
    setImporting(false)
    toast[result.ok ? "success" : "error"](result.message)
    if (result.ok) {
      setImportFile(null)
      router.refresh()
    }
  }

  async function runAction(action: () => Promise<{ ok: boolean; message: string }>) {
    const result = await action()
    toast[result.ok ? "success" : "error"](result.message)
    if (result.ok) router.refresh()
    return result.ok
  }

  function openEdit(record: CourseRecordData) {
    setEditRecord(record)
    setEditState({
      orderNumber: record.orderNumber === null ? "" : String(record.orderNumber),
      texts: Object.fromEntries(
        COURSE_RECORD_TEXT_FIELDS.map((field) => [field, record[field] ?? ""])
      ) as Record<CourseRecordTextField, string>,
    })
  }

  async function handleSaveRecord() {
    if (!editRecord || !editState || saving) return
    setSaving(true)
    const orderText = editState.orderNumber.trim()
    const payload = {
      orderNumber: orderText === "" ? null : Number(orderText),
      ...Object.fromEntries(
        COURSE_RECORD_TEXT_FIELDS.map((field) => [field, editState.texts[field].trim() || null])
      ),
    }
    const result = await updateCourseRecordAction(editRecord.id, payload)
    setSaving(false)
    toast[result.ok ? "success" : "error"](result.message)
    if (result.ok) {
      setEditRecord(null)
      setEditState(null)
      router.refresh()
    }
  }

  return (
    <div className="mt-6 grid gap-6">
      {/* Імпорт */}
      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold">Імпорт з Excel</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Файл .xlsx зі списком курсантів (дані з 2-го рядка). Записи можна редагувати після імпорту.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="grid gap-1.5">
            <Label htmlFor="course-file">Файл Excel</Label>
            <Input
              id="course-file"
              type="file"
              accept=".xlsx"
              className="w-64"
              onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="course-label">Назва курсу</Label>
            <Input
              id="course-label"
              value={importLabel}
              onChange={(event) => setImportLabel(event.target.value)}
              className="w-48"
              placeholder="28.09.2026"
            />
          </div>
          <Button type="button" onClick={() => void handleImport()} disabled={importing || !importFile}>
            {importing ? <Loader2 className="size-4 animate-spin" /> : null}
            Імпортувати
          </Button>
        </div>
      </section>

      {/* Курси */}
      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3 text-sm font-semibold">Курси</div>
        {courses.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Ще немає жодного імпорту.</p>
        ) : (
          <ul className="divide-y">
            {courses.map((course) => (
              <li
                key={course.id}
                className={cn(
                  "flex flex-wrap items-center gap-2 px-4 py-3 text-sm",
                  course.id === selectedId && "bg-muted/50"
                )}
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left font-medium hover:underline"
                  title="Показати записи курсу"
                  onClick={() => router.push(`/admin/courses?course=${course.id}`)}
                >
                  {course.label}
                </button>
                <span className="text-xs text-muted-foreground">
                  {course.recordCount} запис(ів) · {course.createdAt.slice(0, 10)}
                </span>
                {course.isActive ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    Активний
                  </span>
                ) : null}
                {!course.isActive && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Зробити активним"
                    onClick={() => void runAction(() => activateCourseAction(course.id))}
                  >
                    <Star className="size-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="Перейменувати"
                  onClick={() => {
                    setRenameCourse(course)
                    setRenameLabel(course.label)
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
                {confirmDeleteCourseId === course.id ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setConfirmDeleteCourseId(null)
                      void runAction(() => deleteCourseAction(course.id))
                    }}
                  >
                    Точно видалити?
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title="Видалити курс і всі його записи"
                    onClick={() => setConfirmDeleteCourseId(course.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Записи обраного курсу */}
      {selectedCourse ? (
        <section className="rounded-lg border bg-card">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <h2 className="text-sm font-semibold">
              Записи курсу «{selectedCourse.label}» · {records.length}
            </h2>
            <div className="relative ml-auto">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Пошук за ПІБ"
                className="h-8 w-56"
              />
              <Search className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">№</th>
                  <th className="px-3 py-2 font-medium">ПІБ</th>
                  <th className="px-3 py-2 font-medium">Звання</th>
                  <th className="px-3 py-2 font-medium">Посада</th>
                  <th className="px-3 py-2 font-medium">Взвод</th>
                  <th className="px-3 py-2 font-medium">№ зброї</th>
                  <th className="px-3 py-2 font-medium">Наявність</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-muted/40">
                    <td className="px-3 py-2 text-xs text-muted-foreground">{record.orderNumber ?? "—"}</td>
                    <td className="max-w-56 truncate px-3 py-2 font-medium" title={record.fullName ?? ""}>
                      {record.fullName ?? "—"}
                    </td>
                    <td className="px-3 py-2">{record.rank ?? "—"}</td>
                    <td className="max-w-40 truncate px-3 py-2" title={record.position ?? ""}>
                      {record.position ?? "—"}
                    </td>
                    <td className="px-3 py-2">{record.platoon ?? "—"}</td>
                    <td className="px-3 py-2">{record.weaponNumber ?? "—"}</td>
                    <td className="px-3 py-2">{record.presence ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title="Редагувати"
                        onClick={() => openEdit(record)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      {confirmDeleteRecordId === record.id ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setConfirmDeleteRecordId(null)
                            void runAction(() => deleteCourseRecordAction(record.id))
                          }}
                        >
                          Точно?
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title="Видалити запис"
                          onClick={() => setConfirmDeleteRecordId(record.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      Записів не знайдено.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          Оберіть курс у списку вище, щоб переглянути й відредагувати його записи.
        </p>
      )}

      {/* Діалог редагування запису */}
      <Dialog
        open={editRecord !== null && editState !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditRecord(null)
            setEditState(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Редагувати запис</DialogTitle>
            <DialogDescription>{editRecord?.fullName}</DialogDescription>
          </DialogHeader>
          {editState ? (
            <div className="max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid gap-4">
                <div className="grid gap-1.5">
                  <Label>№ п/п</Label>
                  <Input
                    value={editState.orderNumber}
                    onChange={(event) =>
                      setEditState({ ...editState, orderNumber: event.target.value })
                    }
                    inputMode="numeric"
                  />
                </div>
                {EDIT_SECTIONS.map((section) => (
                  <fieldset key={section.title} className="rounded-lg border p-3">
                    <legend className="px-1 text-xs font-medium text-muted-foreground">
                      {section.title}
                    </legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {section.fields.map((field) => (
                        <div key={field.name} className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
                          <Label htmlFor={`record-${field.name}`}>{field.label}</Label>
                          <Input
                            id={`record-${field.name}`}
                            value={editState.texts[field.name]}
                            onChange={(event) =>
                              setEditState({
                                ...editState,
                                texts: { ...editState.texts, [field.name]: event.target.value },
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditRecord(null)
                setEditState(null)
              }}
            >
              Скасувати
            </Button>
            <Button type="button" onClick={() => void handleSaveRecord()} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Зберегти
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Діалог перейменування курсу */}
      <Dialog open={renameCourse !== null} onOpenChange={(open) => !open && setRenameCourse(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Перейменувати курс</DialogTitle>
            <DialogDescription>Назва показується в списку курсів.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="rename-course">Назва курсу</Label>
            <Input
              id="rename-course"
              value={renameLabel}
              onChange={(event) => setRenameLabel(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameCourse(null)}>
              Скасувати
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!renameCourse) return
                void runAction(() => renameCourseAction(renameCourse.id, renameLabel)).then((ok) => {
                  if (ok) setRenameCourse(null)
                })
              }}
            >
              Зберегти
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
