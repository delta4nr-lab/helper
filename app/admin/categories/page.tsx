import { CategoryManager } from "@/components/admin/category-manager"
import { orm } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function AdminCategoriesPage() {
  const categories = await orm.Category.orderBy([
    (c) => c.sortOrder.asc(),
    (c) => c.title.asc(),
  ])
    .include("templates", (t) => t.count())
    .all()

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        Категорії документів
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Створення та впорядкування розділів каталогу.
      </p>
      <CategoryManager initialCategories={categories} />
    </>
  )
}
