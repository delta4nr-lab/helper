import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight } from "lucide-react"

import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { getCategory } from "@/lib/documents/catalog"
import { orm } from "@/lib/db"
import { DocumentEditor } from "@/components/documents/docx-editor/document-editor"

type Params = { category: string; templateId: string }

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { category, templateId } = await params
  try {
    const tpl = await orm.Template.select("title", "description").first({ id: templateId })
    if (tpl) {
      const cat = await orm.Category.select("title").first({ slug: category })
      return {
        title: `${tpl.title} — ${cat?.title ?? "Шаблони"}`,
        description: tpl.description,
      }
    }
  } catch {}
  const cat = getCategory(category)
  return { title: `Шаблон — ${cat?.title ?? "Шаблони"}` }
}

export default async function TemplateDetailPage({ params }: { params: Promise<Params> }) {
  const { category, templateId } = await params

  let categoryTitle = category
  let title = "Шаблон"
  let fields: { key: string; label: string; type: string }[] = []
  let personnel: { id: string; lastName: string; firstName: string; middleName: string | null; rank: string; position: string; signaturePath: string | null }[] = []

  try {
    const dbCat = await orm.Category.select("title").first({ slug: category })
    if (dbCat) categoryTitle = dbCat.title

    const dbTpl = await orm.Template.where({ id: templateId, isActive: true })
      .include("templateFields", (f) => f.orderBy((field) => field.sortOrder.asc()))
      .first()
    if (!dbTpl) notFound()

    title = dbTpl.title
    fields = (dbTpl.templateFields ?? []).map((f) => ({
      key: String(f.key),
      label: String(f.label),
      type: String((f as unknown as { _type?: string })._type ?? "text"),
    }))

    personnel = await orm.Personnel.orderBy((p) => p.lastName.asc()).limit(500).all()
  } catch {
    notFound()
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">
            Головна
          </Link>
          <ChevronRight className="size-3.5" />
          <Link href="/templates" className="hover:text-foreground">
            Шаблони
          </Link>
          <ChevronRight className="size-3.5" />
          <Link href={`/templates/${category}`} className="hover:text-foreground">
            {categoryTitle}
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="font-medium text-foreground">{title}</span>
        </nav>

        <div className="mt-4 flex-1">
          <DocumentEditor templateId={templateId} title={title} fields={fields} personnel={personnel} />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
