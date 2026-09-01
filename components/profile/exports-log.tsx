import Link from "next/link"
import { Download, FileText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type ExportedFile = {
  id: string
  title: string
  fileName: string
  mimeType: string
  size: number
  createdAt: string
  template: { title: string } | null
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date))
}

function formatSize(size: number) {
  return size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} КБ` : `${(size / 1024 / 1024).toFixed(1)} МБ`
}

export function ExportsLog({ files }: { files: ExportedFile[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Історія експортів</CardTitle>
        <CardDescription>{files.length ? `Збережено файлів: ${files.length}` : "Експортовані документи з’являться тут."}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {files.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">Заповніть шаблон і натисніть «Експортувати DOCX».</div>
        ) : (
          <div className="divide-y">
            {files.map((file) => (
              <div key={file.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="size-4" /></span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{file.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{file.template?.title ?? "Шаблон"}</span><span>•</span><span>{formatDate(file.createdAt)}</span><Badge variant="outline" className="rounded-full text-[10px]">DOCX · {formatSize(file.size)}</Badge>
                    </div>
                  </div>
                </div>
                <Link href={`/api/exports/${file.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full shrink-0 sm:w-auto")}><Download className="size-3.5" />Завантажити</Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
