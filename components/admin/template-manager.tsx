"use client"

import * as React from "react"
import Link from "next/link"
import { FileText, Pencil, Trash2 } from "lucide-react"

import { deleteTemplateAction } from "@/lib/documents/actions"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Template = {
  id: string
  title: string
  categorySlug: string
  categoryTitle: string
  description: string
  fields: number
  isActive: boolean
  updatedAt: string
}

export function TemplateManager({
  initialTemplates,
}: {
  initialTemplates: Template[]
}) {
  const [templates, setTemplates] = React.useState(initialTemplates)
  const [message, setMessage] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  function remove(template: Template) {
    if (!window.confirm(`Видалити шаблон «${template.title}»?`)) return
    startTransition(async () => {
      const result = await deleteTemplateAction(template.id)
      setMessage(result.message)
      if (result.ok)
        setTemplates((current) =>
          result.message.includes("деактивовано")
            ? current.map((item) =>
                item.id === template.id ? { ...item, isActive: false } : item
              )
            : current.filter((item) => item.id !== template.id)
        )
    })
  }

  return (
    <Card className="mt-6">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-sm">Шаблони</CardTitle>
          <CardDescription>
            Редагуйте вміст або деактивуйте непотрібні шаблони.
          </CardDescription>
        </div>
        <Link
          href="/admin/templates/new"
          className={cn(buttonVariants({ size: "sm" }))}
        >
          <FileText className="size-4" />
          Новий шаблон
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {templates.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Шаблонів ще немає.
            </div>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className="flex flex-wrap items-center gap-3 px-4 py-4"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {template.title}
                  </div>
                  <div className="mt-1 truncate text-xs text-muted-foreground">
                    {template.categoryTitle} · {template.fields} полів ·{" "}
                    {template.id}
                  </div>
                  <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                    {template.description || "Без опису"}
                  </div>
                </div>
                <Badge variant={template.isActive ? "secondary" : "outline"}>
                  {template.isActive ? "Активний" : "Прихований"}
                </Badge>
                <div className="flex items-center gap-1">
                  <Link
                    href={`/admin/templates/${template.id}/edit`}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "icon-sm" })
                    )}
                    aria-label="Редагувати"
                  >
                    <Pencil className="size-3.5" />
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    disabled={pending}
                    onClick={() => remove(template)}
                    aria-label="Видалити"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
        {message && (
          <p className="border-t px-4 py-3 text-sm text-muted-foreground">
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
