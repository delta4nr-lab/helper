"use client"

// Панель персоналу (template-режим, панель праворуч від документа):
// степер екземпляра [−] 1..10 [ + ] керує personInstance ТІЛЬКИ для нових
// вставлених нод, і чотири кнопки заготовлених полів — ПІБ, Посада,
// Звання, Підпис. Натискання вставляє FieldNode у позицію каретки через
// публічний insertCustomNode (та сама схема «nodes without a payload»:
// attrs → w:tag, lock: false — чіп редагований). Ідентичність поля —
// схема staff.{index}.{field} у слоті key тега (getStaffTag): рушій
// розпізнає тільки acme:* теги, тому номер людини живе в identity-ключі.
// personInstance — ГРУПА полів одного працівника в цьому документі;
// personnelId (конкретна людина) прив'язується пізніше через hover-піквер
// (personnel-picker.tsx).

import * as React from "react"
import { insertCustomNode } from "@docx-editor.dev/pro"
import { useDocxEditor } from "@docx-editor.dev/react"
import { Minus, Plus } from "lucide-react"
import { toast } from "sonner"

import {
  placeCaretBesideField,
  suspendFieldSelect,
} from "@/components/documents/docx-editor/field-select"
import { FieldNode } from "@/lib/docx-editor/field-node"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type PersonnelFieldType = "fullName" | "position" | "rank" | "signature"

export type PersonnelEntry = {
  id: string
  fullName: string
  rank: string
  position: string
  signaturePath: string | null
}

export const PERSONNEL_FIELD_LABELS: Record<PersonnelFieldType, string> = {
  fullName: "ПІБ",
  position: "Посада",
  rank: "Звання",
  signature: "Підпис",
}

// Схема ідентичності персональних полів: буде прочитана майбутнім
// автозаповненням із attrs ноди (illy key у тезі FieldNode).
export function getStaffTag(index: number, field: string): string {
  return `staff.${index}.${field}`
}

const INSERT_TOAST_ID = "personnel-insert"
const MAX_INSTANCE = 10
const LOG = "[personnel-panel]"

export function PersonnelPanel() {
  const editor = useDocxEditor()
  const [instance, setInstance] = React.useState(1)

  const fields = Object.keys(PERSONNEL_FIELD_LABELS) as PersonnelFieldType[]

  async function insertField(fieldType: PersonnelFieldType) {
    if (!editor) return
    // Identity сповідного чіпа: один ключ (схема staff.{i}.{f}) в attrs →
    // w:tag; fieldType/personInstance виводяться з key у fromDocx. Тег
    // короткий (≤ 64 перевірено) — переповнення неможливе.
    const attrs = { key: getStaffTag(instance, fieldType) }
    const label = `${PERSONNEL_FIELD_LABELS[fieldType]} (${instance})`
    // Авто-виділення FieldSelect призупинено на час вставки+розміщення —
    // той самий патерн, що й у field-insert-dialog.
    suspendFieldSelect(true)
    // Виділений текст замінюється нодою: insertCustomNode вставляє в точку
    // head виділення без видалення, тому спершу очищаємо виділення
    // публічною командою paste { text: "" } («at the selection, replacing
    // it» — payload аргументом, системний буфер не чіпається); відмова →
    // fallback cut («delete it», мінус — текст іде в буфер обміну).
    const snapshot = editor.snapshot()
    if (!snapshot.selectionCollapsed) {
      let cleared = editor.exec({ type: "paste", text: "" })
      if (!cleared.ok) {
        console.info(LOG, "paste-clear відхилено → fallback cut →", {
          code: cleared.code,
          reason: cleared.reason,
        })
        cleared = editor.exec({ type: "cut" })
      }
      if (!cleared.ok) {
        console.info(LOG, "очищення виділення не вдалося →", {
          code: cleared.code,
          reason: cleared.reason,
        })
      } else {
        console.info(LOG, "виділення очищено →", {
          collapsed: editor.snapshot().selectionCollapsed,
        })
      }
    }
    const result = insertCustomNode(editor, FieldNode, {
      attrs,
      text: label,
      alias: label,
      lock: false,
    })
    if (!result.ok) {
      suspendFieldSelect(false)
      toast.error(result.reason ?? "Не вдалося вставити поле.")
      return
    }
    toast.success(`Поле «${label}» вставлено.`, { id: INSERT_TOAST_ID })
    // Каретка одразу за нодою — той самий рушійний шлях, що й у field-insert-dialog.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        void placeCaretBesideField(editor).finally(() => suspendFieldSelect(false))
      })
    )
  }

  return (
    <div className="w-64 shrink-0 rounded-lg border bg-card p-3">
      <div className="text-sm font-semibold">Персонал</div>

      <div className="mt-3 text-xs text-muted-foreground">
        Екземпляр — для якої людини зараз вставляються поля
      </div>
      <div className="mt-1 inline-flex items-center gap-1.5 rounded-lg border p-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Попередній екземпляр"
          disabled={instance <= 1}
          onClick={() => setInstance((v) => Math.max(1, v - 1))}
        >
          <Minus className="size-4" />
        </Button>
        <span
          className={cn(
            "min-w-8 text-center text-sm font-medium tabular-nums",
            !editor && "text-muted-foreground"
          )}
        >
          {instance}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Наступний екземпляр"
          disabled={instance >= MAX_INSTANCE}
          onClick={() => setInstance((v) => Math.min(MAX_INSTANCE, v + 1))}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      <div className="mt-3 text-xs text-muted-foreground">Поля</div>
      <div className="mt-1 grid grid-cols-2 gap-2">
        {fields.map((fieldType) => (
          <Button
            key={fieldType}
            type="button"
            variant="outline"
            size="sm"
            disabled={!editor}
            onClick={() => void insertField(fieldType)}
          >
            {PERSONNEL_FIELD_LABELS[fieldType]}
          </Button>
        ))}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Вставлені поля цього екземпляра прив&apos;язуються до працівника кнопкою на чіпі в документі.
      </p>
    </div>
  )
}
