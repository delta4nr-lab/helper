import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Doc = {
  id: string
  title: string
  status: string
  template: { title: string } | null
  categorySlug: string
  createdAt: Date
  updatedAt: Date
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("uk-UA", { dateStyle: "medium", timeStyle: "short" }).format(d)
}

export function DocumentsLog({ documents }: { documents: Doc[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Журнал документів</CardTitle>
        <CardDescription>
          {documents.length === 0
            ? "Поки немає створених документів"
            : `Всього ${documents.length} документ(ів) — створені вами`}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {documents.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-muted-foreground">
            Документи з&apos;являться тут після створення з шаблону.
          </div>
        ) : (
          <div className="divide-y">
            {documents.map((doc) => (
              <div key={doc.id} className="flex flex-col gap-1.5 px-6 py-3 hover:bg-muted/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium leading-tight">{doc.title}</span>
                  <Badge variant={doc.status === "підписано" ? "default" : doc.status === "в архіві" ? "secondary" : "outline"} className="rounded-full text-[11px]">
                    {doc.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {doc.template && (
                    <>
                      <span>{doc.template.title}</span>
                    </>
                  )}
                  <span>• {doc.categorySlug}</span>
                  <span>• {formatDate(doc.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
