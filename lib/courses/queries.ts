import "server-only"

import { orm } from "@/lib/db"
import type { CourseRecordData } from "@/lib/courses/types"

// Шар даних курсів: адмінка і майбутній пікер курсантів у редакторі
// працюють через ці функції, а не з orm напряму.

export async function getActiveCourse() {
  return orm.Course.select("id", "label", "fileName", "createdAt")
    .where({ isActive: true })
    .first()
}

export async function getCourseRecords(courseId: string): Promise<CourseRecordData[]> {
  const records = await orm.CourseRecord.where({ courseId })
    .orderBy([(r) => r.lastName.asc(), (r) => r.firstName.asc()])
    .all()
  return records
}

export async function getActiveCourseRecords(): Promise<CourseRecordData[]> {
  const course = await getActiveCourse()
  if (!course) return []
  return getCourseRecords(course.id)
}
