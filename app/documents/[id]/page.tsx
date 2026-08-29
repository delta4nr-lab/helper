import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Download, Edit, FileText } from "lucide-react"

import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { prisma } from "@/lib/db"
import { DocumentRenderer } from "@/lib/documents/renderers/document-renderer"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

type Params = { id: string }

export default async function DocumentViewPage({ params }: { params: Promise<Params> }) {
  const { id } = await params

  let doc: any = null
  try {
    if (prisma && (prisma as unknown as { document: unknown }).document) {
      doc = await prisma.document.findUnique({
        where: { id },
        include: { template: true, personnel: true, author: { select: { username: true } } },
      })
    }
  } catch {}
  if (!doc) notFound()

  const personnelLabel = doc.personnel ? `${doc.personnel.lastName} ${doc.personnel.firstName} ${doc.personnel.middleName ?? ""}`.trim() : undefined

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight">{doc.title}</h1>
            <Badge variant={doc.status === "чернетка" ? "secondary" : "default"} className="rounded-full">{doc.status}</Badge>
          </div>
          <div className="flex gap-2">
            <Link href={`/documents/${doc.id}/edit`} className={cn(buttonVariants({ size: "sm" }))}>
              <Edit className="size-4" />
              Редагувати
            </Link>
            <Link href={`/api/documents/${doc.id}/docx`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <Download className="size-4" />
              DOCX
            </Link>
            <Link href={`/templates/${doc.categorySlug}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <ArrowLeft className="size-4" />
              До категорії
            </Link>
          </div>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle className="text-sm">Попередній перегляд — {doc.template?.title}</CardTitle>
          </CardHeader>
          <CardContent className="bg-white p-0 dark:bg-zinc-900">
            <DocumentRenderer
              templateId={doc.templateId}
              data={doc.data}
              personnelLabel={personnelLabel}
              authorLabel={doc.author?.username}
              headerTemplate={doc.template?.headerTemplate}
              bodyTemplate={doc.template?.bodyTemplate}
              footerTemplate={doc.template?.footerTemplate}
            />
          </CardContent>
        </Card>

        <div className="mt-6 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>Автор: {doc.author?.username ?? "—"}</span>
          <span>•</span>
          <span>Створено: {new Date(doc.createdAt).toLocaleString("uk-UA")}</span>
          <span>•</span>
          <span>Оновлено: {new Date(doc.updatedAt).toLocaleString("uk-UA")}</span>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
