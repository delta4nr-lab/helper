"use client"

import * as React from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Check, ChevronsUpDown, Loader2, Save, Eye, Search, X } from "lucide-react"

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
  signaturePath: string | null
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

// Типи полів, які описують людину/підписанта — вибираються зі штату
const SPECIAL_FIELD_TYPES = new Set(["signature", "rank", "person", "position"])

// Пошуковий вибір людини зі штату (замість простого Select — зручно для великого штату)
function PersonPicker({
  personnel,
  value,
  onChange,
  placeholder,
}: {
  personnel: Personnel[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const ref = React.useRef<HTMLDivElement>(null)
  const selected = personnel.find((p) => p.id === value)

  React.useEffect(() => {
    if (!open) return
    function onDocClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node))
        setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? personnel.filter((p) =>
        `${p.lastName} ${p.firstName} ${p.middleName ?? ""} ${p.rank} ${p.position}`
          .toLowerCase()
          .includes(q)
      )
    : personnel

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 text-sm shadow-sm hover:bg-muted/40"
      >
        <span
          className={
            selected ? "truncate font-medium" : "truncate text-muted-foreground"
          }
        >
          {selected
            ? `${selected.rank} ${selected.firstName} ${selected.lastName}`
            : (placeholder ?? "Оберіть зі штату")}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-lg">
          <div className="flex items-center gap-2 border-b px-2.5 py-2">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Пошук: прізвище, звання, посада"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-56 overflow-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                Нічого не знайдено
              </div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onChange(p.id)
                    setOpen(false)
                    setQuery("")
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-muted"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {p.firstName} {p.middleName ?? ""} {p.lastName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.rank} · {p.position}
                    </span>
                  </span>
                  {p.id === value && (
                    <Check className="size-4 shrink-0 text-primary" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function DocumentForm({ template, fields, personnel }: Props) {
  // Кастомні шаблони не повинні перевірятися схемою іншого документа.
  const schema = getDocumentSchema(template.id)?.schema

  const form = useForm<Record<string, unknown>>({
    resolver: schema
      ? (zodResolver(schema as unknown as never) as never)
      : undefined,
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

  // Групуємо спеціальні слоти (підпис/звання/ПІБ/посада) за числовим суфіксом — одна «людина»
  const personGroups = React.useMemo(() => {
    const special = fields.filter((f) => SPECIAL_FIELD_TYPES.has(f.type))
    const groups = new Map<string, FieldConfig[]>()
    for (const f of special) {
      const match = f.key.match(/_(\d+)$/)
      const suffix = match ? match[1] : f.key
      const arr = groups.get(suffix) ?? []
      arr.push(f)
      groups.set(suffix, arr)
    }
    return Array.from(groups.values()).map((slots) => ({
      slots,
      anchorKey: slots[0].key,
      title: slots.some((s) => s.type === "signature") ? "Підписант" : "Людина",
    }))
  }, [fields])

  const regularFields = React.useMemo(
    () => fields.filter((f) => !SPECIAL_FIELD_TYPES.has(f.type)),
    [fields]
  )

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
            {personGroups.length > 0 && (
              <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
                <Label className="text-xs font-medium">
                  Підписанти (особовий склад)
                </Label>
                {personGroups.map((group, index) => {
                  const current = String(form.watch(group.anchorKey) ?? "")
                  const signatureKey = group.slots.find((s) => s.type === "signature")?.key
                  const signatureChecked = signatureKey ? Boolean(form.watch(signatureKey)) : false
                  return (
                    <div key={group.anchorKey} className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">
                        {group.title}
                        {personGroups.length > 1 ? ` ${index + 1}` : ""}
                      </Label>
                      <div className="flex items-center gap-1">
                        <div className="min-w-0 flex-1">
                          <PersonPicker
                            personnel={personnel}
                            value={current}
                            onChange={(id) => {
                              group.slots.forEach((slot) =>
                                form.setValue(slot.key, id, { shouldDirty: true })
                              )
                            }}
                          />
                        </div>
                        {current && (
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                            title="Прибрати людину"
                            aria-label="Прибрати людину"
                            onClick={() => {
                              group.slots.forEach((slot) =>
                                form.setValue(slot.key, "", { shouldDirty: true })
                              )
                            }}
                          >
                            <X className="size-4" />
                          </Button>
                        )}
                      </div>
                      {signatureKey && (
                        <label
                          className={`flex w-fit cursor-pointer items-center gap-1.5 text-xs text-muted-foreground ${!current ? "opacity-50" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={signatureChecked}
                            disabled={!current}
                            onChange={(event) => {
                              if (event.target.checked) {
                                const id = group.slots
                                  .map((s) => form.getValues(s.key))
                                  .find((v) => typeof v === "string" && v)
                                if (id) form.setValue(signatureKey, String(id), { shouldDirty: true })
                              } else {
                                form.setValue(signatureKey, "", { shouldDirty: true })
                              }
                            }}
                          />
                          Підпис
                        </label>
                      )}
                      {current && (
                        <span className="text-xs text-muted-foreground">
                          У документі:{" "}
                          {group.slots
                            .filter((s) => !signatureKey || s.key !== signatureKey || signatureChecked)
                            .map((s) => s.label)
                            .join(" · ")}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {regularFields.map((f) => {
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
                                {p.firstName} {p.lastName} — {p.rank},{" "}
                                {p.position} ({p.id.slice(0, 4)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {selectedPersonnel && (
                      <span className="text-xs text-muted-foreground">
                        Обрано: {selectedPersonnel.firstName} {selectedPersonnel.lastName},{" "}
                        {selectedPersonnel.rank}
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
          <CardHeader className="flex-row items-center justify-between border-b">
            <span className="text-sm font-medium">
              Попередній перегляд — А4{" "}
              {template.headerTemplate || template.bodyTemplate ? "· Word" : ""}
            </span>
          </CardHeader>
          <CardContent className="overflow-auto bg-zinc-100 p-2 sm:p-3 dark:bg-zinc-900">
            <DocumentRenderer
              templateId={template.id}
              data={previewData}
              paper={template.paper}
              personnelLabel={
                selectedPersonnel
                  ? `${selectedPersonnel.firstName} ${selectedPersonnel.middleName ?? ""} ${selectedPersonnel.lastName}`.trim()
                  : undefined
              }
              headerTemplate={template.headerTemplate}
              bodyTemplate={template.bodyTemplate}
              footerTemplate={template.footerTemplate}
              personnel={personnel}
              fields={fields}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
