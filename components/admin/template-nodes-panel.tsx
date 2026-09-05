"use client"

import * as React from "react"
import { Loader2, Search } from "lucide-react"
import { toast } from "sonner"

import { ensureTemplateFieldAction } from "@/lib/templates/actions"
import { COURSE_FIELD_LABELS, COURSE_RECORD_TEXT_FIELDS } from "@/lib/courses/types"

import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

// Панель заготовлених нод: клік вставляє текст-маркер {{key}} рівно в каретку
// (execCommand — нативний ввід). При збереженні шаблона маркери перетворюються
// на content controls через showingPlcHdr.

type NodeItem = { key: string; label: string; type: string }

const COURSE_NODES: NodeItem[] = COURSE_RECORD_TEXT_FIELDS.map((field) => ({
  key: `course:${field}`,
  label: COURSE_FIELD_LABELS[field] ?? field,
  type: "course",
}))

const STAFF_NODES: NodeItem[] = [
  { key: "staff:person", label: "ПІБ (персонал)", type: "staff" },
  { key: "staff:position", label: "Посада (персонал)", type: "staff" },
  { key: "staff:rank", label: "Звання (персонал)", type: "staff" },
  { key: "staff:signature", label: "Підпис (персонал)", type: "staff" },
]

function NodeButton({
  node,
  inserting,
  onClick,
}: {
  node: NodeItem
  inserting: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // Каретка редактора має лишитися на місці: не віддаємо фокус кнопці
      onMouseDown={(event) => event.preventDefault()}
      disabled={inserting}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-left text-sm transition-colors hover:border-primary/50 hover:bg-muted/50 disabled:opacity-60"
      )}
    >
      <span className="truncate">{node.label}</span>
      {inserting ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
      ) : null}
    </button>
  )
}

export function TemplateNodesPanel({
  templateId,
}: {
  templateId: string
}) {
  const [insertingKey, setInsertingKey] = React.useState<string | null>(null)
  const [courseSearch, setCourseSearch] = React.useState("")
  const [customKey, setCustomKey] = React.useState("")
  const [customLabel, setCustomLabel] = React.useState("")

  const filteredCourseNodes = React.useMemo(() => {
    const needle = courseSearch.trim().toLowerCase()
    if (!needle) return COURSE_NODES
    return COURSE_NODES.filter((node) => node.label.toLowerCase().includes(needle))
  }, [courseSearch])

  async function insertNode(node: NodeItem) {
    if (insertingKey) return
    setInsertingKey(node.key)
    const marker = `{{${node.key}}}`
    const typed = document.execCommand("insertText", false, marker)
    if (!typed) {
      setInsertingKey(null)
      toast.error("Не вдалося вставити маркер. Клацніть у документ і спробуйте ще раз.")
      return
    }
    const fieldResult = await ensureTemplateFieldAction(templateId, {
      key: node.key,
      label: node.label,
      _type: node.type,
    })
    setInsertingKey(null)
    if (!fieldResult.ok) {
      toast.error(fieldResult.message)
      return
    }
    toast.success(`Маркер «${node.label}» вставлено — при збереженні стане полем.`)
  }

  async function insertCustom() {
    const key = customKey.trim()
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key)) {
      toast.error("Ключ: латиниця, цифри та _, з літери.")
      return
    }
    if (!customLabel.trim()) {
      toast.error("Вкажіть назву поля.")
      return
    }
    if (insertingKey) return
    setInsertingKey(key)
    const marker = `{{${key}}}`
    const typed = document.execCommand("insertText", false, marker)
    if (!typed) {
      setInsertingKey(null)
      toast.error("Не вдалося вставити маркер. Клацніть у документ і спробуйте ще раз.")
      return
    }
    const fieldResult = await ensureTemplateFieldAction(templateId, {
      key,
      label: customLabel.trim(),
      _type: "custom",
    })
    setInsertingKey(null)
    if (!fieldResult.ok) {
      toast.error(fieldResult.message)
      return
    }
    toast.success(`Поле «${customLabel.trim()}» вставлено — при збереженні стане полем.`)
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-l border-border/50 bg-card">
      <div className="border-b px-3 py-2 text-sm font-semibold">Заготовлені ноди</div>
      <Tabs defaultValue="course" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="w-full">
          <TabsTrigger value="course">Курсанти</TabsTrigger>
          <TabsTrigger value="personnel">Персонал</TabsTrigger>
          <TabsTrigger value="custom">Кастомні</TabsTrigger>
        </TabsList>

        <TabsContent value="course" className="min-h-0 flex-1 overflow-y-auto p-2">
          <div className="relative mb-2">
            <Input
              value={courseSearch}
              onChange={(event) => setCourseSearch(event.target.value)}
              placeholder="Пошук поля"
              className="h-8 pr-8"
            />
            <Search className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
          <div className="grid gap-1.5">
            {filteredCourseNodes.map((node) => (
              <NodeButton
                key={node.key}
                node={node}
                inserting={insertingKey === node.key}
                onClick={() => void insertNode(node)}
              />
            ))}
            {filteredCourseNodes.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">Не знайдено.</p>
            )}
          </div>
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            Автозаповнення з активного курсу.
          </p>
        </TabsContent>

        <TabsContent value="personnel" className="min-h-0 flex-1 overflow-y-auto p-2">
          <div className="grid gap-1.5">
            {STAFF_NODES.map((node) => (
              <NodeButton
                key={node.key}
                node={node}
                inserting={insertingKey === node.key}
                onClick={() => void insertNode(node)}
              />
            ))}
          </div>
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            Автозаповнення з картки персоналії.
          </p>
        </TabsContent>

        <TabsContent value="custom" className="min-h-0 flex-1 overflow-y-auto p-2">
          <div className="grid gap-2">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground" htmlFor="custom-key">
                Ключ (латиницею)
              </label>
              <Input
                id="custom-key"
                value={customKey}
                onChange={(event) => setCustomKey(event.target.value)}
                placeholder="my_field"
                className="h-8"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground" htmlFor="custom-label">
                Назва поля
              </label>
              <Input
                id="custom-label"
                value={customLabel}
                onChange={(event) => setCustomLabel(event.target.value)}
                placeholder="Мій текст"
                className="h-8"
              />
            </div>
            <button
              type="button"
              onClick={() => void insertCustom()}
              onMouseDown={(event) => event.preventDefault()}
              disabled={insertingKey !== null}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-left text-sm transition-colors hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <span className="truncate">Вставити в каретку</span>
              {insertingKey === customKey ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
              ) : null}
            </button>
            <p className="px-1 text-xs text-muted-foreground">
              Введіть ключ і назву — маркер стане в каретку.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </aside>
  )
}
