import { CourseManager } from "@/components/admin/course-manager"
import { orm } from "@/lib/db"
import type { CourseListItem, CourseRecordData } from "@/lib/courses/types"

export const dynamic = "force-dynamic"

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>
}) {
  const { course: selectedParam } = await searchParams

  const [courses, allRecords] = await Promise.all([
    orm.Course.select("id", "label", "fileName", "isActive", "createdAt").all(),
    orm.CourseRecord.select("courseId").all(),
  ])

  const countByCourse = new Map<string, number>()
  for (const record of allRecords) {
    countByCourse.set(
      record.courseId,
      (countByCourse.get(record.courseId) ?? 0) + 1
    )
  }

  const courseList: CourseListItem[] = courses
    .map((course) => ({
      id: course.id,
      label: course.label,
      fileName: course.fileName,
      isActive: course.isActive,
      createdAt: String(course.createdAt),
      recordCount: countByCourse.get(course.id) ?? 0,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const selected =
    courseList.find((course) => course.id === selectedParam) ??
    courseList.find((course) => course.isActive) ??
    null

  const records: CourseRecordData[] = selected
    ? await orm.CourseRecord.where({ courseId: selected.id })
        .orderBy([
          (record) => record.lastName.asc(),
          (record) => record.firstName.asc(),
        ])
        .all()
    : []

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Курси</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Імпорт списків курсантів з Excel, редагування записів і керування
        активним курсом для сайту.
      </p>
      <CourseManager
        courses={courseList}
        selectedId={selected?.id ?? null}
        records={records}
      />
    </>
  )
}
