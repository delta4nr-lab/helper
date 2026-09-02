import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight } from "lucide-react"

import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { getCategory, templates } from "@/lib/documents/catalog"
import { orm } from "@/lib/db"
import { composeDocumentHtml } from "@/lib/documents/editor/fill-html"
import { DocumentEditor } from "@/components/documents/document-editor"

type Params = { category: string; templateId: string }

export const dynamic = "force-dynamic"

export function generateStaticParams() {
  return templates.map((t) => ({
    category: t.categorySlug,
    templateId: t.id,
  }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>
}): Promise<Metadata> {
  const { category, templateId } = await params
  try {
    const tpl = await orm.Template.first({ id: templateId })
    if (tpl) {
      const cat = getCategory(category)
      return {
        title: `${tpl.title} — ${cat?.title ?? "Шаблони"}`,
        description: tpl.description,
      }
    }
  } catch {}
  const tpl = getCategory(category) ? templates.find((t) => t.id === templateId) : null
  if (!tpl) return { title: "Шаблон не знайдено" }
  const cat = getCategory(category)
  return {
    title: `${tpl.title} — ${cat?.title ?? "Шаблони"}`,
    description: tpl.description,
  }
}

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<Params>
}) {
  const { category, templateId } = await params

  const fallbackCat = getCategory(category)
  const fallbackTpl = fallbackCat ? templates.find((t) => t.id === templateId) : null

  let categoryTitle = fallbackCat?.title ?? category
  let title = fallbackTpl?.title ?? "Шаблон"
  let paper = fallbackTpl?.paper ?? "А4"
  let content: string | null = fallbackTpl ? "<p></p>" : null
  let personnel: { id: string; lastName: string; firstName: string; middleName: string | null; rank: string; position: string; signaturePath: string | null }[] = []

  try {
    const dbCat = await orm.Category.first({ slug: category })
    if (dbCat) categoryTitle = dbCat.title
    const dbTpl = await orm.Template.where({ id: templateId }).include("templateFields", (f) => f.orderBy((field) => field.sortOrder.asc())).first()
    if (dbTpl) {
      title = dbTpl.title
      const dbPaper = (dbTpl as unknown as { paper?: string }).paper
      paper = dbPaper === "А4 альбом" ? "А4 альбом" : "А4"
      const fields = (dbTpl.templateFields ?? []).map((f) => ({
        key: String(f.key),
        label: String(f.label),
        type: String((f as unknown as { _type?: string })._type ?? "text"),
      }))
      content =
        composeDocumentHtml(
          {
            header: (dbTpl as unknown as { headerTemplate?: string | null }).headerTemplate,
            body: (dbTpl as unknown as { bodyTemplate?: string | null }).bodyTemplate,
            footer: (dbTpl as unknown as { footerTemplate?: string | null }).footerTemplate,
          },
          fields
        ) ?? "<p></p>"
    }
    personnel = await orm.Personnel.orderBy((p) => p.lastName.asc()).limit(500).all()
  } catch {}

  if (!fallbackCat && !content) notFound()

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
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

        <div className="mt-6">
          <DocumentEditor templateId={templateId} title={title} paper={paper} content={content} personnel={personnel} />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}