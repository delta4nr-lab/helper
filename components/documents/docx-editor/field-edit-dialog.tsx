"use client"

// Edit-рядок кастомних ручних полів у контекстному меню — канонічний
// патерн документации («Chips are content-locked by default, so editing
// runs through the context menu» + CustomNodeContextMenu onEditNode).
// Ручні поля: payload лише { key } — прев'язка/значення через
// updateCustomNode(editor, FieldNode, nodeId, { data: { key }, text }).
// Актуальний nodeId — тільки з результату операції. Персональні чіпи
// (payload.fieldType) пропускаються: у них свій потік прив'язки
// персоналу (personnel-picker.tsx).
//
// Активація несе nodeId/text/data для префілу форми («The activation
// carries nodeId, the node's text and its data»).

import * as React from "react"
import { CustomNodeContextMenu } from "@docx-editor.dev/pro/react"
import type { ActivatedCustomNode } from "@docx-editor.dev/pro"
import { customNodesOf, encodeCustomNodeTag, updateCustomNode } from "@docx-editor.dev/pro"
import { useDocxEditor } from "@docx-editor.dev/react"
import { toast } from "sonner"

import {
  FIELD_TAG_PREFIX,
  FieldNode,
  type FieldChipAttrs,
} from "@/lib/docx-editor/field-node"
import { suspendFieldSelect } from "@/components/documents/docx-editor/field-select"

import { FIELD_KEY_PATTERN } from "@/components/documents/docx-editor/field-insert-dialog"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const LOG = "[field-edit]"

export function FieldEditMenu() {
  const [active, setActive] = React.useState<ActivatedCustomNode | null>(null)

  function handleEditNode(node: ActivatedCustomNode) {
    // Ручні поля only: attrs без fieldType/personInstance. Персональні
    // чіпи прив'язуються через PersonnelChrome, а не через цю форму.
    const attrs = node.attrs as FieldChipAttrs
    if (!attrs.key || attrs.fieldType || attrs.personInstance) return
    setActive(node)
  }

  return (
    <>
      {/* Edit-рядок персональних/ручного поля: відкриття форми тільки на
          ручних полях (персональні — через PersonnelChrome) */}
      <CustomNodeContextMenu onEditNode={handleEditNode} />
      {active && (
        <FieldEditForm
          initialKey={
            typeof (active.attrs as Record<string, unknown>).key === "string"
              ? String((active.attrs as Record<string, unknown>).key)
              : ""
          }
          initialText={active.text ?? ""}
          nodeId={typeof active.nodeId === "string" ? active.nodeId : undefined}
          onDone={() => setActive(null)}
        />
      )}
    </>
  )
}

function FieldEditForm({
  initialKey,
  initialText,
  nodeId,
  onDone,
}: {
  initialKey: string
  initialText: string
  nodeId?: string
  onDone: () => void
}) {
  const editor = useDocxEditor()
  const [key, setKey] = React.useState(initialKey)
  const [title, setTitle] = React.useState(initialText)

  // Ключі інших полів — дублікати заборонені (свій ключ не рахується).
  const takenKeys = React.useMemo(() => {
    if (!editor || !nodeId) return new Set<string>()
    const keys = new Set<string>()
    for (const node of customNodesOf(editor)) {
      if (node.nodeId === nodeId) continue
      const key = (node.attrs as FieldChipAttrs).key
      if (key) keys.add(key)
    }
    return keys
  }, [editor, nodeId])

  const normalizedKey = key.trim()
  const normalizedTitle = title.trim()
  const keyError =
    normalizedKey && !FIELD_KEY_PATTERN.test(normalizedKey)
      ? "Ключ: латиниця, цифри та _, з літери."
      : null
  const duplicateError =
    !keyError && normalizedKey && takenKeys.has(normalizedKey)
      ? "Поле з таким ключем уже вставлено."
      : null
  // Тег = acme:field + ?key=<ключ> — валідуємо фабричним encodeCustomNodeTag.
  const tagOverflowError =
    !keyError && normalizedKey
      ? encodeCustomNodeTag(FIELD_TAG_PREFIX, FieldNode.name, { key: normalizedKey }).ok
        ? null
        : "Ключ завеликий для тега поля (ліміт Word — 64 символи)."
      : null
  const canSubmit =
    editor !== null &&
    Boolean(nodeId) &&
    normalizedKey !== "" &&
    normalizedTitle !== "" &&
    !keyError &&
    !duplicateError &&
    !tagOverflowError

  async function handleSave() {
    if (!editor || !canSubmit || !nodeId) return
    // Група оновлень рухає каретку — авто-виділення FieldSelect призупинено
    // (bounceSuspend-патерн).
    suspendFieldSelect(true)
    try {
      // Identity оновлюється цілком: ключ переписується в тезі (ручні поля
      // не мають personnelId — прив'язка персоналу — це PersonnelChrome).
      const result = updateCustomNode(editor, FieldNode, nodeId, {
        attrs: { key: normalizedKey },
        text: normalizedTitle,
      })
      console.info(LOG, "update →", {
        fromId: nodeId,
        ok: result.ok,
        newId: result.ok ? result.nodeId : undefined,
        reason: result.ok ? undefined : result.reason,
      })
      if (!result.ok) {
        toast.error(result.reason ?? "Не вдалося зберегти поле.")
        return
      }
      toast.success("Поле оновлено.")
      onDone()
    } finally {
      suspendFieldSelect(false)
    }
  }

  return (
    <Dialog open onOpenChange={onDone}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Редагувати кастомне поле</DialogTitle>
          <DialogDescription>
            Значення ключа і назви переписують ноду на місці (один undo-крок).
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="field-edit-key">Ключ</Label>
            <Input
              id="field-edit-key"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  void handleSave()
                }
              }}
              autoFocus
            />
            {(keyError ?? duplicateError) && (
              <p className="text-xs text-destructive">{keyError ?? duplicateError}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="field-edit-title">Назва (текст у документі)</Label>
            <Input
              id="field-edit-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  void handleSave()
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone}>
            Скасувати
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={!canSubmit}>
            Зберегти
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
