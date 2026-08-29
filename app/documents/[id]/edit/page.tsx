import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { buttonVariants } from "@/components/ui/button"
import { prisma } from "@/lib/db"
import { DocumentForm } from "@/components/documents/document-form"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

type Params = { id: string }

export default async function DocumentEditPage({ params }: { params: Promise<Params> }) {
  const { id } = await params

  let doc: any = null
  let template: any = null
  let personnel: any[] = []
  let dbError: string | null = null
  try {
    // Перевіряємо чи prisma ініціалізовано (після фіксу lib/db.ts)
    if (!prisma || !(prisma as unknown as { document: unknown }).document) {
      throw new Error("Prisma не ініціалізовано — перевірте DATABASE_URL та `npx prisma generate`")
    }
    doc = await prisma.document.findUnique({ where: { id } })
    if (!doc) {
      // Спроба по slug з title (для /templates/raporty/[slug] сумісності)
      const all = await prisma.document.findMany({ where: { categorySlug: "raporty" }, take: 100 })
      const slug = id.toLowerCase()
      doc = all.find((d) => d.id === id || d.title.toLowerCase().replace(/[^a-z0-9а-яіїєґ]+/gi, "-").includes(slug) || d.title.toLowerCase().includes(slug)) ?? null
    }
    if (!doc) notFound()
    template = await prisma.template.findUnique({
      where: { id: doc.templateId },
      include: { fieldsConfig: { orderBy: { sortOrder: "asc" } } },
    })
    if (!template) notFound()
    personnel = await prisma.personnel.findMany({ orderBy: { lastName: "asc" }, take: 50 })
  } catch (e) {
    const msg = (e as Error).message
    // Якщо це notFound — прокидуємо далі
    if (msg.includes("NEXT_NOT_FOUND")) throw e
    dbError = msg
    console.error("[DocumentEditPage] DB error:", msg)
  }
  if (dbError) {
    return (
      <div className="flex min-h-svh flex-col bg-background">
        <SiteHeader />
        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6">
            <h1 className="text-lg font-semibold text-destructive">Помилка завантаження документа</h1>
            <p className="mt-2 text-sm text-muted-foreground">ID: {id}</p>
            <p className="mt-2 text-sm">{dbError}</p>
            <p className="mt-2 text-xs text-muted-foreground">Перевірте `DATABASE_URL` в `.env`, виконайте `npx prisma generate` та `npx tsx prisma/seed.ts`, перезапустіть dev сервер.</p>
          </div>
        </main>
        <SiteFooter />
      </div>
    )
  }
  if (!doc || !template) notFound()

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Редагування: {doc.title}</h1>
          <Link href={`/documents/${doc.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <ArrowLeft className="size-4" />
            Назад
          </Link>
        </div>

        <DocumentForm
          template={{
            id: template.id,
            title: template.title,
            categorySlug: template.categorySlug,
            headerTemplate: (template as { headerTemplate?: string | null }).headerTemplate ?? null,
            bodyTemplate: (template as { bodyTemplate?: string | null }).bodyTemplate ?? null,
            footerTemplate: (template as { footerTemplate?: string | null }).footerTemplate ?? null,
          }}
          fields={template.fieldsConfig.map((f: { key: string; label: string; type: string; required: boolean; placeholder: string | null; options: unknown; sortOrder: number }) => ({
            key: f.key,
            label: f.label,
            type: f.type,
            required: f.required,
            placeholder: f.placeholder,
            options: f.options,
            sortOrder: f.sortOrder,
          }))}
          personnel={personnel}
          initialData={doc.data as Record<string, unknown>}
          documentId={doc.id}
        />
      </main>
      <SiteFooter />
    </div>
  )
}
