import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { orm } from "@/lib/db"
import { TemplateForm } from "./template-form"

export const dynamic = "force-dynamic"

export default async function NewTemplatePage() {
  const categories = await orm.Category.where({ isActive: true })
    .orderBy((c) => c.sortOrder.asc())
    .select("slug", "title")
    .all()

  return <div className="flex min-h-svh flex-col bg-background"><SiteHeader /><main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:px-8"><h1 className="mb-6 text-xl font-semibold tracking-tight">Створення шаблону</h1><TemplateForm categories={categories} /></main><SiteFooter /></div>
}