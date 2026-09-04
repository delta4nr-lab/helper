import { CourseManager } from "@/components/admin/course-manager"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { orm } from "@/lib/db"
import type { CourseListItem, CourseRecordData } from "@/lib/courses/types"

export const dynamic = "force-dynamic"

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>
}) {
  const { course: selectedParam } = await searchParams

  const courses = await orm.Course
    .select("id", "label", "fileName", "isActive", "createdAt")
    .all()

  const courseList: CourseListItem[] = (await Promise.all(
    courses.map(async (course) => {
      const aggregate = await orm.CourseRecord
        .where({ courseId: course.id })
        .aggregate((agg) => ({ count: agg.count() }))
      return {
        id: course.id,
        label: course.label,
        fileName: course.fileName,
        isActive: course.isActive,
        createdAt: String(course.createdAt),
        recordCount: aggregate.count,
      }
    })
  )).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const selected =
    courseList.find((course) => course.id === selectedParam) ??
    courseList.find((course) => course.isActive) ??
    null

  const records: CourseRecordData[] = selected
    ? await orm.CourseRecord
        .where({ courseId: selected.id })
        .orderBy([(record) => record.lastName.asc(), (record) => record.firstName.asc()])
        .all()
    : []

  return (
    <div className="min-h-svh bg-muted/20">
      <SiteHeader />
      <div className="mx-auto flex max-w-[1440px] items-start">
        <AdminSidebar />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold tracking-tight">Курси</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Імпорт списків курсантів з Excel, редагування записів і керування активним курсом для сайту.
          </p>
          <CourseManager
            courses={courseList}
            selectedId={selected?.id ?? null}
            records={records}
          />
        </main>
      </div>
      <SiteFooter />
    </div>
  )
}
