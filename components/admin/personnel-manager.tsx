"use client"

import * as React from "react"
import { ImagePlus, Loader2, Pencil, Plus, Trash2, X } from "lucide-react"

import { createPersonnelAction, updatePersonnelAction, deletePersonnelAction } from "@/lib/personnel/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Person = {
  id: string
  lastName: string
  firstName: string
  middleName: string | null
  rank: string
  position: string
  status: string
  signaturePath: string | null
}

type FormState = {
  lastName: string
  firstName: string
  middleName: string
  rank: string
  position: string
  status: string
  signaturePath: string
}

const emptyForm: FormState = { lastName: "", firstName: "", middleName: "", rank: "", position: "", status: "в строю", signaturePath: "" }

const STATUS_OPTIONS = ["в строю", "відрядження", "відпустка"]

export function PersonnelManager({ initialPeople }: { initialPeople: Person[] }) {
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Person | null>(null)
  const [form, setForm] = React.useState<FormState>(emptyForm)
  const [preview, setPreview] = React.useState<string | null>(null)
  const [uploading, setUploading] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()

  function update(key: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function openAdd() {
    setEditing(null)
    setForm(emptyForm)
    setPreview(null)
    setMessage(null)
    setOpen(true)
  }

  function openEdit(person: Person) {
    setEditing(person)
    setForm({
      lastName: person.lastName,
      firstName: person.firstName,
      middleName: person.middleName ?? "",
      rank: person.rank,
      position: person.position,
      status: person.status,
      signaturePath: person.signaturePath ?? "",
    })
    setPreview(person.signaturePath)
    setMessage(null)
    setOpen(true)
  }

  async function handleSignatureFile(file: File | null) {
    if (!file) return
    setUploading(true)
    setMessage(null)
    const body = new FormData()
    body.append("file", file)
    try {
      const response = await fetch("/api/signature/upload", { method: "POST", body })
      const result = (await response.json()) as { path?: string; message?: string }
      if (!response.ok || !result.path) {
        setMessage(result.message ?? "Не вдалося завантажити підпис.")
        return
      }
      setForm((current) => ({ ...current, signaturePath: result.path as string }))
      setPreview(result.path)
    } catch {
      setMessage("Не вдалося завантажити підпис.")
    } finally {
      setUploading(false)
    }
  }

  function clearSignature() {
    setForm((current) => ({ ...current, signaturePath: "" }))
    setPreview(null)
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    startTransition(async () => {
      const result = editing ? await updatePersonnelAction(editing.id, form) : await createPersonnelAction(form)
      setMessage(result.message)
      if (result.ok) {
        setOpen(false)
        window.location.reload()
      }
    })
  }

  function remove(person: Person) {
    if (!window.confirm(`Видалити ${person.lastName} ${person.firstName} зі штату?`)) return
    startTransition(async () => {
      const result = await deletePersonnelAction(person.id)
      if (result.ok) {
        setMessage(null)
        window.location.reload()
      } else {
        setMessage(result.message)
      }
    })
  }

  return (
    <Card className="mt-6">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-sm">Особовий склад</CardTitle>
          <CardDescription>Список людей, які можуть підписувати документи.</CardDescription>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="size-4" />
          Додати
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {initialPeople.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            Штат порожній. Натисніть «Додати», щоб внести першу людину.
          </div>
        ) : (
          <div className="divide-y">
            {initialPeople.map((person) => (
              <div key={person.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-xs font-semibold">
                  {person.signaturePath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={person.signaturePath} alt="Підпис" className="size-full object-contain p-1" />
                  ) : (
                    person.lastName.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    {[person.lastName, person.firstName, person.middleName].filter(Boolean).join(" ")}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {person.rank} · {person.position}
                  </div>
                </div>
                <Badge variant={person.status === "в строю" ? "default" : "secondary"}>{person.status}</Badge>
                <div className="flex shrink-0 items-center gap-1">
                  <Button type="button" size="icon-sm" variant="ghost" aria-label="Редагувати" title="Редагувати" onClick={() => openEdit(person)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" className="text-destructive hover:text-destructive" aria-label="Видалити" title="Видалити" onClick={() => remove(person)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Редагувати людину" : "Нова людина"}</DialogTitle>
            <DialogDescription>Заповніть ПІБ, звання та інші дані особового складу.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="person-last-name">Прізвище</Label>
                <Input id="person-last-name" required value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="person-first-name">Ім’я</Label>
                <Input id="person-first-name" required value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="person-middle-name">По батькові</Label>
                <Input id="person-middle-name" value={form.middleName} onChange={(e) => update("middleName", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="person-rank">Звання</Label>
                <Input id="person-rank" required value={form.rank} onChange={(e) => update("rank", e.target.value)} />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="person-position">Посада</Label>
                <Input id="person-position" required value={form.position} onChange={(e) => update("position", e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="person-status">Статус</Label>
              <Select items={STATUS_OPTIONS.map((value) => ({ value, label: value }))} value={form.status} onValueChange={(value) => update("status", value ?? "в строю")}>
                <SelectTrigger id="person-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5 border-t pt-4">
              <Label htmlFor="person-signature">Підпис (фото)</Label>
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="Підпис" className="size-full object-contain p-1" />
                  ) : (
                    <span className="text-xs text-muted-foreground">Немає підпису</span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium shadow-sm hover:bg-muted">
                    {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
                    {uploading ? "Завантаження..." : "Завантажити"}
                    <input
                      id="person-signature"
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={(e) => {
                        void handleSignatureFile(e.target.files?.[0] ?? null)
                        e.target.value = ""
                      }}
                    />
                  </label>
                  {preview && (
                    <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive" onClick={clearSignature}>
                      <X className="size-3" /> Прибрати
                    </Button>
                  )}
                </div>
              </div>
            </div>
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Скасувати
              </Button>
              <Button type="submit" disabled={pending || uploading}>
                {pending ? "Збереження..." : editing ? "Зберегти" : "Додати"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}