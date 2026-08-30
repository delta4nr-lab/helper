"use client"

import * as React from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Save, Eye } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getDocumentSchema } from "@/lib/documents/registry"
import { DocumentRenderer } from "@/lib/documents/renderers/document-renderer"

type FieldConfig = {
  key: string
  label: string
  type: string
  required: boolean
  placeholder?: string | null
  options?: unknown
  sortOrder: number
}

type Personnel = {
  id: string
  lastName: string
  firstName: string
  middleName: string | null
  rank: string
  position: string
}

type Props = {
  template: {
    id: string
    title: string
    categorySlug: string
    headerTemplate?: string | null
    bodyTemplate?: string | null
    footerTemplate?: string | null
    paper?: string | null
  }
  fields: FieldConfig[]
  personnel: Personnel[]
}

export function DocumentForm({ template, fields, personnel }: Props) {
  // Кастомні шаблони не повинні перевірятися схемою іншого документа.
  const schema = getDocumentSchema(template.id)?.schema

  const form = useForm<Record<string, unknown>>({
    resolver: schema ? (zodResolver(schema as unknown as never) as never) : undefined,
    defaultValues: {
      personnelId: "",
      documentType: "щорічна",
      startDate: "",
      durationDays: "",
      location: "",
      documentNumber: "",
      documentDate: "",
      contactPhone: "",
      basis: "",
    },
    mode: "onBlur",
  })

  const [pending, setPending] = React.useState(false)
  const [serverMessage, setServerMessage] = React.useState<{
    ok: boolean
    message: string
  } | null>(null)

  const values = form.watch()
  // Реальний час — прев'ю оновлюється при кожному введенні без кнопки
  const previewData = React.useMemo(() => {
    const data = { ...values } as Record<string, unknown>
    if (
      data.durationDays !== undefined &&
      data.durationDays !== "" &&
      data.durationDays !== null
    ) {
      const n = Number(data.durationDays)
      if (!Number.isNaN(n)) data.durationDays = n
    }
    return data
  }, [values])

  const selectedPersonnel = personnel.find((p) => p.id === values.personnelId)

  async function onSubmit(data: Record<string, unknown>) {
    setPending(true)
    setServerMessage(null)
    try {
      const response = await fetch(`/api/templates/${template.id}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      })
      const result = (await response.json()) as {
        message?: string
        downloadUrl?: string
      }
      if (!response.ok) {
        setServerMessage({
          ok: false,
          message: result.message ?? "Не вдалося експортувати документ.",
        })
        return
      }

      setServerMessage({
        ok: true,
        message: "DOCX збережено у вашому профілі. Завантаження розпочато.",
      })
      if (result.downloadUrl) {
        const link = window.document.createElement("a")
        link.href = result.downloadUrl
        link.download = ""
        link.click()
      }
    } catch {
      setServerMessage({
        ok: false,
        message: "Не вдалося підключитися до сервера. Спробуйте ще раз.",
      })
    } finally {
      setPending(false)
    }
  }

  function onInvalid(errors: unknown) {
    const e = errors as Record<string, { message?: unknown }>
    const invalidFields = Object.keys(e as object)
      .map((key) => fields.find((field) => field.key === key)?.label ?? key)
      .join(", ")
    setServerMessage({
      ok: false,
      message: invalidFields
        ? `Перевірте поля: ${invalidFields}.`
        : "Заповніть обов’язкові поля та виправте помилки у формі.",
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.9fr]">
      <Card>
        <CardHeader className="border-b bg-muted/20">
          <CardTitle className="text-sm">Заповнення шаблону</CardTitle>
          <CardDescription className="text-sm">
            Заповніть поля, перевірте попередній перегляд і завантажте готовий
            DOCX.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form
            onSubmit={form.handleSubmit(onSubmit, onInvalid)}
            className="grid gap-4"
          >
            {fields.map((f) => {
              const error = form.formState.errors[f.key]?.message as
                string | undefined
              // personnel
              if (f.type === "personnel") {
                return (
                  <div key={f.key} className="grid gap-1.5">
                    <Label className="text-xs font-medium">
                      {f.label}{" "}
                      {!f.required && (
                        <span className="text-muted-foreground">
                          (необов&apos;язково)
                        </span>
                      )}
                    </Label>
                    <Controller
                      control={form.control}
                      name={f.key}
                      render={({ field }) => (
                        <Select
                          value={(field.value as string) || "__none__"}
                          onValueChange={(v) =>
                            field.onChange(v === "__none__" ? "" : v)
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue
                              placeholder={f.placeholder ?? "Оберіть"}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">
                              — Без вибору (ручний ввід) —
                            </SelectItem>
                            {personnel.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.lastName} {p.firstName} — {p.rank},{" "}
                                {p.position} ({p.id.slice(0, 4)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {selectedPersonnel && (
                      <span className="text-xs text-muted-foreground">
                        Обрано: {selectedPersonnel.lastName}{" "}
                        {selectedPersonnel.firstName}, {selectedPersonnel.rank}
                      </span>
                    )}
                    {error && (
                      <span className="text-xs text-destructive">{error}</span>
                    )}
                  </div>
                )
              }
              if (f.type === "select" && Array.isArray(f.options)) {
                return (
                  <div key={f.key} className="grid gap-1.5">
                    <Label className="text-xs font-medium">
                      {f.label}{" "}
                      {f.required && (
                        <span className="text-destructive">*</span>
                      )}
                    </Label>
                    <Controller
                      control={form.control}
                      name={f.key}
                      render={({ field }) => (
                        <Select
                          value={field.value as string}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue
                              placeholder={f.placeholder ?? "Оберіть"}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {(f.options as string[]).map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {error && (
                      <span className="text-xs text-destructive">{error}</span>
                    )}
                  </div>
                )
              }
              if (f.type === "textarea") {
                return (
                  <div key={f.key} className="grid gap-1.5">
                    <Label className="text-xs font-medium">
                      {f.label}{" "}
                      {!f.required && (
                        <span className="text-muted-foreground">
                          (необов&apos;язково)
                        </span>
                      )}
                    </Label>
                    <Textarea
                      placeholder={f.placeholder ?? ""}
                      {...form.register(f.key)}
                      className="min-h-20"
                    />
                    {error && (
                      <span className="text-xs text-destructive">{error}</span>
                    )}
                  </div>
                )
              }
              if (f.type === "number") {
                return (
                  <div key={f.key} className="grid gap-1.5">
                    <Label className="text-xs font-medium">
                      {f.label}{" "}
                      {f.required && (
                        <span className="text-destructive">*</span>
                      )}
                    </Label>
                    <Input
                      type="number"
                      placeholder={f.placeholder ?? ""}
                      {...form.register(f.key)}
                      className="h-8"
                    />
                    {error && (
                      <span className="text-xs text-destructive">{error}</span>
                    )}
                  </div>
                )
              }
              if (f.type === "date") {
                return (
                  <div key={f.key} className="grid gap-1.5">
                    <Label className="text-xs font-medium">
                      {f.label}{" "}
                      {f.required && (
                        <span className="text-destructive">*</span>
                      )}
                    </Label>
                    <Input
                      type="date"
                      {...form.register(f.key)}
                      className="h-8"
                    />
                    {error && (
                      <span className="text-xs text-destructive">{error}</span>
                    )}
                  </div>
                )
              }
              // text default
              return (
                <div key={f.key} className="grid gap-1.5">
                  <Label className="text-xs font-medium">
                    {f.label}{" "}
                    {f.required && <span className="text-destructive">*</span>}
                  </Label>
                  <Input
                    placeholder={f.placeholder ?? ""}
                    {...form.register(f.key)}
                    className="h-8"
                  />
                  {error && (
                    <span className="text-xs text-destructive">{error}</span>
                  )}
                </div>
              )
            })}

            {serverMessage && (
              <p
                className={`rounded-lg px-3 py-2 text-sm ${serverMessage.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30" : "bg-destructive/10 text-destructive"}`}
              >
                {serverMessage.message}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={pending}
                className="cursor-pointer"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Експортувати DOCX
              </Button>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30">
                <Eye className="size-3.5" />
                Превʼю оновлюється в реальному часі →
              </span>
            </div>
          </form>
        </CardContent>
        <CardFooter className="border-t bg-muted/20 text-xs text-muted-foreground">
          Після експорту файл автоматично з’явиться в історії вашого профілю.
        </CardFooter>
      </Card>

      <div className="space-y-4">
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between border-b bg-muted/30 py-3">
            <span className="text-sm font-medium">
              Попередній перегляд — А4{" "}
              {template.headerTemplate || template.bodyTemplate ? "· Word" : ""}
            </span>
          </CardHeader>
          <CardContent className="overflow-auto bg-zinc-100 p-2 dark:bg-zinc-900 sm:p-3">
            <DocumentRenderer
              templateId={template.id}
              data={previewData}
              paper={template.paper}
              personnelLabel={
                selectedPersonnel
                  ? `${selectedPersonnel.lastName} ${selectedPersonnel.firstName} ${selectedPersonnel.middleName ?? ""}`.trim()
                  : undefined
              }
              headerTemplate={template.headerTemplate}
              bodyTemplate={template.bodyTemplate}
              footerTemplate={template.footerTemplate}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
