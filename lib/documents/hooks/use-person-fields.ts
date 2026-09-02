"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { getMarkRange } from "@tiptap/core"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"

import type { GroupInfo, Personnel, PickerTarget } from "@/components/documents/types"

const SPECIAL_FIELD_TYPES = new Set(["signature", "rank", "person", "position"])

export const MENU_LABELS: Record<string, string> = {
  position: "Посада — оберіть зі штату",
  rank: "Звання — оберіть зі штату",
  person: "ПІБ — оберіть зі штату",
  signature: "Підпис — оберіть особу",
}

// Порожній невидимий символ — вміст поля «Підпис» після вибору особи, щоб над підписом не було ПІБ
const ZWSP = "\u200B"

function fullName(p: Personnel): string {
  return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ")
}

type Options = {
  editor: Editor | null
  personnel: Personnel[]
}

// Відповідає за business logic спеціальних полів (position/rank/person/signature):
// групування полів, hover-тригер, вибір особи, очищення групи/підпису.
export function usePersonFields({ editor, personnel }: Options) {
  // refs: належать цьому hook, але монтуються в UI (workspace)
  const contentWrapRef = React.useRef<HTMLDivElement>(null)
  const triggerWrapRef = React.useRef<HTMLDivElement>(null)
  const mouseDownRef = React.useRef(false)

  const [menuOpen, setMenuOpen] = React.useState(false)
  const [pickerTarget, setPickerTarget] = React.useState<PickerTarget | null>(null)

  // Кеш групи для hover-поля — не перераховуємо на кожен mousemove
  const groupCacheRef = React.useRef<{ pos: number; hasSignature: boolean; groupPersonId: string | null } | null>(null)
  // Прямокутник hover-поля (viewport-координати) — для «зони утримання» тригера
  const fieldRectRef = React.useRef<{ left: number; top: number; right: number; bottom: number } | null>(null)

  // Клік мишею по fill-полю: якщо вміст — це назва поля (незаповнене), виділяємо його,
  // щоб друк одразу замінив підпис.
  function handleFieldSelection(ed: Editor) {
    if (!mouseDownRef.current) return
    mouseDownRef.current = false
    if (!ed.isActive("fill")) return
    const attrs = (ed.getAttributes("fill") ?? {}) as { fillKey?: string; fillType?: string; fillLabel?: string }
    const label = attrs.fillLabel ?? attrs.fillKey ?? ""
    const range = getMarkRange(ed.state.doc.resolve(ed.state.selection.from), ed.schema.marks.fill)
    if (!range) return
    const text = ed.state.doc.textBetween(range.from, range.to, " ")
    if (text === label) ed.commands.setTextSelection(range)
  }

  // Блок (абзац/комірка), в якому знаходиться позиція — для групування полів без числового суфікса
  function resolveGroupBlock(anchorPos: number): { from: number; to: number } | null {
    if (!editor) return null
    const $r = editor.state.doc.resolve(anchorPos)
    let d = $r.depth
    while (d > 0 && $r.node(d).isInline) d -= 1
    if (d === 0) return null
    return { from: $r.before(d), to: $r.after(d) }
  }

  // Чи є в групі заповнений підпис (щоб показати дію «Видалити підпис»)
  function groupHasSignature(suffix: string, anchorPos?: number): boolean {
    if (!editor) return false
    const fillType = editor.schema.marks.fill
    const numeric = /^\d+$/.test(suffix)
    const block = anchorPos != null ? resolveGroupBlock(anchorPos) : null
    let found = false
    editor.state.doc.descendants((node, pos) => {
      if (!node.isInline) return true
      const mark = node.marks.find((m) => m.type === fillType)
      if (!mark) return true
      const attrs = mark.attrs as { fillKey?: string; fillType?: string; personId?: string | null }
      if (attrs.fillType !== "signature") return true
      const key = attrs.fillKey ?? ""
      if (numeric) {
        if (!key.endsWith(`_${suffix}`)) return true
      } else {
        if (!block) return true
        if (pos < block.from || pos >= block.to) return true
      }
      if (attrs.personId) found = true
      return true
    })
    return found
  }

  // Особу, прив'язану до групи (з будь-якого заповненого поля) — для фільтрації меню.
  function groupPerson(suffix: string, anchorPos?: number): string | null {
    if (!editor) return null
    const fillType = editor.schema.marks.fill
    const numeric = /^\d+$/.test(suffix)
    const block = anchorPos != null ? resolveGroupBlock(anchorPos) : null
    let result: string | null = null
    editor.state.doc.descendants((node, pos) => {
      if (result) return false
      if (!node.isInline) return true
      const mark = node.marks.find((m) => m.type === fillType)
      if (!mark) return true
      const attrs = mark.attrs as { fillKey?: string; personId?: string | null }
      const key = attrs.fillKey ?? ""
      if (numeric) {
        if (!key.endsWith(`_${suffix}`)) return true
      } else {
        if (!block) return true
        if (pos < block.from || pos >= block.to) return true
      }
      if (attrs.personId) {
        result = attrs.personId
        return false
      }
      return true
    })
    return result
  }

  // Застосовує до всіх fill-полів групи функцію update.
  // Група: поля з тим самим числовим суфіксом (напр. *_1) по всьому документу,
  // а для полів без суфікса — усі спеціальні поля в тому ж блоці (абзаці/комірці).
  // update повертає marked-вузол (текст або зображення підпису) для вставки, або null — лишити як є.
  function updateGroupFields(
    suffix: string,
    update: (attrs: { fillKey: string; fillType: string; fillLabel: string; personId: string | null }) =>
      | { content: ProseMirrorNode }
      | null,
    anchorPos?: number
  ) {
    if (!editor) return
    const fillType = editor.schema.marks.fill
    const state = editor.state
    const ops: { from: number; to: number; content: ProseMirrorNode }[] = []
    const seen = new Set<string>()
    const numeric = /^\d+$/.test(suffix)
    const block = anchorPos != null ? resolveGroupBlock(anchorPos) : null
    state.doc.descendants((node, pos) => {
      if (!node.isInline) return true
      const mark = node.marks.find((m) => m.type === fillType)
      if (!mark) return true
      const attrs = mark.attrs as { fillKey?: string; fillType?: string; fillLabel?: string; personId?: string | null }
      const key = attrs.fillKey ?? ""
      if (numeric) {
        if (!key.endsWith(`_${suffix}`)) return true
      } else {
        if (!block) return true
        if (pos < block.from || pos >= block.to) return true
      }
      const range = getMarkRange(state.doc.resolve(pos), fillType)
      if (!range) return true
      const rangeKey = `${range.from}-${range.to}`
      if (seen.has(rangeKey)) return true
      seen.add(rangeKey)
      const result = update({
        fillKey: key,
        fillType: attrs.fillType ?? "text",
        fillLabel: attrs.fillLabel ?? key,
        personId: attrs.personId ?? null,
      })
      if (result) ops.push({ from: range.from, to: range.to, content: result.content })
      return true
    })
    if (ops.length === 0) return
    const tr = state.tr
    for (const op of ops.reverse()) {
      tr.delete(op.from, op.to)
      tr.insert(op.from, op.content)
    }
    editor.view.dispatch(tr)
    editor.commands.focus()
  }

  function computeGroup(target: { pos: number; key: string }): GroupInfo {
    const cache = groupCacheRef.current
    if (cache && cache.pos === target.pos) {
      return { hasSignature: cache.hasSignature, groupPersonId: cache.groupPersonId }
    }
    const suffix = target.key.match(/_(\d+)$/)?.[1] ?? target.key
    const result = {
      hasSignature: groupHasSignature(suffix, target.pos),
      groupPersonId: groupPerson(suffix, target.pos),
    }
    groupCacheRef.current = { pos: target.pos, ...result }
    return result
  }

  // Поле (special) під курсором миші — для показу тригера по наведенню.
  function findPickerTarget(event: React.MouseEvent): PickerTarget | null {
    if (!editor) return null
    const el = (event.target as HTMLElement | null)?.closest?.("span[data-fill-key]")
    if (!(el instanceof HTMLElement)) return null
    const type = el.getAttribute("data-fill-type") ?? "text"
    if (!SPECIAL_FIELD_TYPES.has(type)) return null
    const pos = editor.view.posAtDOM(el, 0)
    if (pos == null) return null
    const range = getMarkRange(editor.state.doc.resolve(pos), editor.schema.marks.fill)
    if (!range) return null
    const key = el.getAttribute("data-fill-key") ?? ""
    const fieldRect = el.getBoundingClientRect()
    const contentRect = contentWrapRef.current?.getBoundingClientRect()
    fieldRectRef.current = { left: fieldRect.left, top: fieldRect.top, right: fieldRect.right, bottom: fieldRect.bottom }
    return {
      key,
      type,
      label: el.getAttribute("data-fill-label") ?? key,
      pos,
      x: contentRect ? fieldRect.left - contentRect.left : fieldRect.left,
      y: contentRect ? fieldRect.top - contentRect.top : fieldRect.top,
      ...computeGroup({ pos, key }),
    }
  }

  // Оновлює стан групи (підпис/особа) для поточного hover-поля після зміни документа.
  function refreshPickerTarget() {
    groupCacheRef.current = null
    setPickerTarget((prev) => {
      if (!prev || !editor) return prev
      return { ...prev, ...computeGroup({ pos: prev.pos, key: prev.key }) }
    })
  }

  // Вибір особи зі штату → заповнює всю групу (ПІБ, посада, звання, підпис) її даними.
  function applyPerson(personId: string, target: PickerTarget) {
    if (!editor) return
    const person = personnel.find((p) => p.id === personId)
    if (!person) return
    const state = editor.state
    const fillType = state.schema.marks.fill
    const suffix = target.key.match(/_(\d+)$/)?.[1] ?? target.key
    const anchorPos = target.pos
    updateGroupFields(
      suffix,
      (attrs) => {
        const mark = fillType.create({
          fillKey: attrs.fillKey,
          fillType: attrs.fillType,
          fillLabel: attrs.fillLabel,
          personId: person.id,
        })
        if (attrs.fillType === "person") return { content: state.schema.text(fullName(person), [mark]) }
        if (attrs.fillType === "position") return { content: state.schema.text(person.position, [mark]) }
        if (attrs.fillType === "rank") return { content: state.schema.text(person.rank, [mark]) }
        if (attrs.fillType === "signature") {
          // Над підписом ПІБ не виводимо — лише зображення підпису (або порожнє поле, якщо файлу немає)
          if (person.signaturePath) {
            const img = state.schema.nodes.signatureImage.create({ src: person.signaturePath, fillKey: attrs.fillKey, personId: person.id })
            return { content: img.mark([mark]) }
          }
          return { content: state.schema.text(ZWSP, [mark]) }
        }
        return null
      },
      anchorPos
    )
    refreshPickerTarget()
    setMenuOpen(false)
  }

  // Скидає всю групу — поля повертаються до підписів (незаповнені), особа знімається.
  function clearGroup(target: PickerTarget) {
    if (!editor) return
    const state = editor.state
    const fillType = state.schema.marks.fill
    const suffix = target.key.match(/_(\d+)$/)?.[1] ?? target.key
    const anchorPos = target.pos
    updateGroupFields(
      suffix,
      (attrs) => {
        const mark = fillType.create({ fillKey: attrs.fillKey, fillType: attrs.fillType, fillLabel: attrs.fillLabel, personId: null })
        return { content: state.schema.text(attrs.fillLabel, [mark]) }
      },
      anchorPos
    )
    refreshPickerTarget()
    setMenuOpen(false)
  }

  // Видаляє лише підпис у групі (ПІБ/посада/звання лишаються), повертаючи напис «Підпис».
  function clearSignature(target: PickerTarget) {
    if (!editor) return
    const state = editor.state
    const fillType = state.schema.marks.fill
    const suffix = target.key.match(/_(\d+)$/)?.[1] ?? target.key
    const anchorPos = target.pos
    updateGroupFields(
      suffix,
      (attrs) => {
        if (attrs.fillType !== "signature") return null
        const mark = fillType.create({ fillKey: attrs.fillKey, fillType: attrs.fillType, fillLabel: attrs.fillLabel, personId: null })
        return { content: state.schema.text(attrs.fillLabel, [mark]) }
      },
      anchorPos
    )
    refreshPickerTarget()
    setMenuOpen(false)
  }

  const pickablePersons = React.useMemo(() => {
    if (!pickerTarget) return []
    // Якщо група вже прив'язана до особи — у полях посада/звання/підпис показуємо лише її,
    // щоб випадково не вибрати іншу людину. ПІБ завжди показує весь штат (зміна особи).
    const candidates =
      pickerTarget.groupPersonId && pickerTarget.type !== "person" ? personnel.filter((p) => p.id === pickerTarget.groupPersonId) : personnel
    return candidates.map((p) => ({
      id: p.id,
      name: fullName(p),
      position: p.position,
      rank: p.rank,
    }))
  }, [pickerTarget, personnel])

  const triggerText = React.useMemo(() => {
    if (!pickerTarget) return ""
    if (pickerTarget.type === "person" && pickerTarget.groupPersonId) {
      const person = personnel.find((p) => p.id === pickerTarget.groupPersonId)
      if (person) return fullName(person)
    }
    return pickerTarget.label
  }, [pickerTarget, personnel])

  return {
    // refs (монтуються в workspace)
    contentWrapRef,
    triggerWrapRef,
    mouseDownRef,
    fieldRectRef,
    // state picker
    menuOpen,
    setMenuOpen,
    pickerTarget,
    setPickerTarget,
    // callbacks
    findPickerTarget,
    handleFieldSelection,
    applyPerson,
    clearGroup,
    clearSignature,
    // похідні для UI тригера
    pickablePersons,
    triggerText,
  }
}