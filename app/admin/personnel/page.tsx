import { PersonnelManager } from "@/components/admin/personnel-manager"
import { orm } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function AdminPersonnelPage() {
  const people = await orm.Personnel.orderBy([
    (p) => p.status.asc(),
    (p) => p.lastName.asc(),
  ])
    .limit(500)
    .all()
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Штат</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Особовий склад: додавайте, редагуйте та переглядайте людей, які можуть
        підписувати документи.
      </p>
      <PersonnelManager initialPeople={people} />
    </>
  )
}
