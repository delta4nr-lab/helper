import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { CategoryManager } from "@/components/admin/category-manager"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { orm } from "@/lib/db"

export const dynamic = "force-dynamic"

export default async function AdminCategoriesPage() {
  const categories = await orm.Category.orderBy([(c) => c.sortOrder.asc(), (c) => c.title.asc()])
    .include("templates", (t) => t.count())
    .all()
  return <div className="min-h-svh bg-muted/20"><SiteHeader /><div className="mx-auto flex max-w-[1440px] items-start"><AdminSidebar /><main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8"><h1 className="text-2xl font-semibold tracking-tight">Категорії документів</h1><p className="mt-1 text-sm text-muted-foreground">Створення та впорядкування розділів каталогу.</p><CategoryManager initialCategories={categories} /></main></div><SiteFooter /></div>
}