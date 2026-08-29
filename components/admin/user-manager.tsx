"use client"

import * as React from "react"
import { Plus } from "lucide-react"

import { createUserAction } from "@/lib/users/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type User = { id: string; username: string; role: string; isActive: boolean; profile: { lastName: string | null; firstName: string | null; rank: string | null } | null; _count: { documents: number } }
type FormState = { username: string; password: string; role: "USER" | "ADMIN"; lastName: string; firstName: string; middleName: string; rank: string }
const emptyForm: FormState = { username: "", password: "", role: "USER", lastName: "", firstName: "", middleName: "", rank: "" }

export function UserManager({ initialUsers }: { initialUsers: User[] }) {
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState(emptyForm)
  const [message, setMessage] = React.useState<string | null>(null)
  const [pending, startTransition] = React.useTransition()
  function update(key: keyof FormState, value: string) { setForm((current) => ({ ...current, [key]: value })) }
  function submit(event: React.FormEvent) { event.preventDefault(); startTransition(async () => { const result = await createUserAction(form); setMessage(result.message); if (result.ok) { setOpen(false); setForm(emptyForm); window.location.reload() } }) }
  return <Card id="users"><CardHeader className="flex-row items-center justify-between gap-3"><div><CardTitle className="text-sm">Користувачі</CardTitle><CardDescription>Облікові записи та доступ до системи.</CardDescription></div><Button size="sm" onClick={() => { setMessage(null); setOpen(true) }}><Plus className="size-4" />Додати</Button></CardHeader><CardContent className="p-0"><div className="divide-y">{initialUsers.map((user) => <div key={user.id} className="flex items-center gap-3 px-4 py-3"><div className="flex size-8 items-center justify-center rounded-lg bg-muted text-xs font-semibold">{user.username.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="text-sm font-medium">{user.username}</div><div className="text-xs text-muted-foreground">{[user.profile?.lastName, user.profile?.firstName, user.profile?.rank].filter(Boolean).join(" · ") || "Профіль не заповнений"}</div></div><Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>{user.role}</Badge><span className="hidden text-xs text-muted-foreground sm:inline">{user._count.documents} документів</span></div>)}</div></CardContent><Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Новий користувач</DialogTitle><DialogDescription>Створіть обліковий запис та за потреби заповніть профіль.</DialogDescription></DialogHeader><form onSubmit={submit} className="grid gap-4"><div className="grid grid-cols-2 gap-3"><div className="grid gap-1.5"><Label htmlFor="new-username">Логін</Label><Input id="new-username" required value={form.username} onChange={(e) => update("username", e.target.value)} /></div><div className="grid gap-1.5"><Label htmlFor="new-password">Пароль</Label><Input id="new-password" required minLength={8} type="password" value={form.password} onChange={(e) => update("password", e.target.value)} /></div></div><div className="grid gap-1.5"><Label htmlFor="new-role">Роль</Label><Select items={[{ value: "USER", label: "Користувач" }, { value: "ADMIN", label: "Адміністратор" }]} value={form.role} onValueChange={(value) => update("role", value ?? "USER")}><SelectTrigger id="new-role" className="h-9 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USER" label="Користувач">Користувач</SelectItem><SelectItem value="ADMIN" label="Адміністратор">Адміністратор</SelectItem></SelectContent></Select></div><div className="grid grid-cols-2 gap-3"><Input aria-label="Прізвище" placeholder="Прізвище" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} /><Input aria-label="Імʼя" placeholder="Імʼя" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} /><Input aria-label="По батькові" placeholder="По батькові" value={form.middleName} onChange={(e) => update("middleName", e.target.value)} /><Input aria-label="Звання" placeholder="Звання" value={form.rank} onChange={(e) => update("rank", e.target.value)} /></div>{message && <p className="text-sm text-destructive">{message}</p>}<DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Скасувати</Button><Button type="submit" disabled={pending}>{pending ? "Створення..." : "Створити користувача"}</Button></DialogFooter></form></DialogContent></Dialog></Card>
}
