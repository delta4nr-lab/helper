"use client"

// Прив'язка персоналу до персональних чіпів (FieldNode, payload має
// fieldType/personInstance/personnelId): компактна hover-кнопка з іконкою
// користувача біля чіпа (через публічний <CustomNodeChrome onNodeHover> +
// node.rect); список персоналу відкривається ТІЛЬКИ кліком по цій кнопці
// (клік по чіпу — звичайний потік виділення/редагування вмісту).
// Вибір людини групово прив'язує ВСІ ноди того самого personInstance
// публічним updateCustomNode: data зберігає key/fieldType/personInstance
// і ОНОВЛЮЄ personnelId; актуальний nodeId береться лише з результату
// операції (rewrite замінює контрол, і старий id далі не резолвиться).
// Підпис при виборі вставляється як РЕАЛЬНЕ зображення (існуючий
// пайплайн insertImageIntoDocument) і виноситься командою
// setImageWrapType 'inFront'; сама нода лишається логічним полем (§12).

import * as React from "react"
import { CustomNodeChrome } from "@docx-editor.dev/pro/react"
import type { ActivatedCustomNode } from "@docx-editor.dev/pro"
import { customNodesOf, decodeCustomNodeTag, updateCustomNode } from "@docx-editor.dev/pro"
import { useDocxEditor } from "@docx-editor.dev/react"
import { Loader2, UserRound } from "lucide-react"
import { toast } from "sonner"

import {
  PERSONNEL_FIELD_LABELS,
  type PersonnelEntry,
} from "@/components/documents/docx-editor/personnel-panel"
import { insertImageIntoDocument } from "@/components/documents/docx-editor/image-insert-dialog"
import { suspendFieldSelect } from "@/components/documents/docx-editor/field-select"
import { FieldNode, type FieldChipAttrs } from "@/lib/docx-editor/field-node"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const LOG = "[personnel-picker]"

// Персональний чіп — FieldNode (identity за тегом acme:field), у attrs
// якого after-fromDocx є fieldType + personInstance (читаються зі схеми
// key = staff.{i}.{f}). Ручні поля (лише key) — не персональні.
function personChipInfo(editor: NonNullable<ReturnType<typeof useDocxEditor>>, node: ActivatedCustomNode) {
  const decoded = decodeCustomNodeTag(node.tag)
  if (!(decoded?.prefix === FieldNode.tagPrefix && decoded.name === FieldNode.name)) return null
  let attrs = node.attrs as FieldChipAttrs
  if (!attrs.fieldType || !attrs.personInstance) {
    // hover-Activation не завжди несе attrs — фолбек: читання з документа
    // за канонічним id (матч за тегом був би завжди першою нодою).
    const match = customNodesOf(editor).find((candidate) => candidate.nodeId === node.nodeId)
    attrs = (match?.attrs ?? attrs) as FieldChipAttrs
  }
  if (!attrs.fieldType || !attrs.personInstance) return null
  return { fieldType: attrs.fieldType, instance: attrs.personInstance }
}

// значення текстових полів із вибраної людини (ПІБ/Посада/Звання)
function textForField(fieldType: string, person: PersonnelEntry): string {
  switch (fieldType) {
    case "fullName":
      return person.fullName
    case "position":
      return person.position
    case "rank":
      return person.rank
    default:
      return ""
  }
}

export function PersonnelChrome({ personnel }: { personnel: PersonnelEntry[] }) {
  const editor = useDocxEditor()
  // hover — плаваюча кнопка над чіпом ([]{ position, personInstance });
  // відкриття списку — тільки кліком по цій кнопці.
  const [hover, setHover] = React.useState<{
    left: number
    top: number
    instance: string
  } | null>(null)
  const [instance, setInstance] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  function handleNodeHover(node: ActivatedCustomNode) {
    const info = editor ? personChipInfo(editor, node) : null
    if (!info) {
      setHover(null)
      return
    }
    setHover({ left: node.rect.right, top: node.rect.top, instance: info.instance })
  }

  function openPicker() {
    if (!hover) return
    setInstance(hover.instance)
    setOpen(true)
    setHover(null)
  }

  // Групове оновлення (§13): тільки існуючі ноди цього personInstance, без
  // створення відсутніх. Актуальний nodeId — тільки з результату операції
  // (updateCustomNode замінює контрол, і старий id далі не резолвиться).
  async function bindPerson(person: PersonnelEntry) {
    if (!editor || !instance) return
    setBusy(true)
    // Група оновлень рухає каретку між нодами — авто-виділення FieldSelect
    // призупинено на весь блок (bounceSuspend-патерн, знімається в finally).
    suspendFieldSelect(true)
    try {
      const nodes = customNodesOf(editor).filter((node) => {
        const attrs = node.attrs as FieldChipAttrs
        return (
          attrs.fieldType != null && attrs.personInstance === String(instance)
        )
      })
      if (nodes.length === 0) {
        toast.error(`Поле екземпляра ${instance} у документі не знайдено.`)
        return
      }
      for (const node of nodes) {
        const attrs = node.attrs as FieldChipAttrs
        const fieldType = attrs.fieldType ?? ""
        const key = attrs.key ?? ""
        const label =
          PERSONNEL_FIELD_LABELS[fieldType as keyof typeof PERSONNEL_FIELD_LABELS] ?? "Поле"
        // identity оновлюється цілком: key зберігається, personnelId (p)
        // дописується в тег; fieldType/personInstance виводяться з key у
        // fromDocx — тому f/i окремо НЕ пишемо.
        const update = updateCustomNode(editor, FieldNode, node.nodeId, {
          attrs: { key, p: person.id },
          // Підпис — логічне поле: чіп лишає свою назву, зображення вставляється окремо.
          text: fieldType === "signature" ? node.text : textForField(fieldType, person),
        })
        console.info(LOG, "update →", {
          fromId: node.nodeId,
          fieldType,
          ok: update.ok,
          newId: update.ok ? update.nodeId : undefined,
          reason: update.ok ? undefined : update.reason,
        })
        if (!update.ok) {
          toast.error(update.reason ?? `Не вдалося оновити поле «${label}».`)
          continue
        }
        // Підпис — РЕАЛЬНЕ зображення (окремий об'єкт документа), не текст.
        if (fieldType === "signature") {
          await bindSignatureImage(person)
        }
      }
      toast.success(`Екземпляр ${instance}: персонал оновлено (${person.fullName}).`)
    } finally {
      suspendFieldSelect(false)
      setOpen(false)
      setBusy(false)
    }
  }

  // Зображення підпису: публічний пайплайн вставки (fetch → normalize →
  // executeImageCommand) + «зображення перед текстом» (setImageWrapType).
  async function bindSignatureImage(person: PersonnelEntry) {
    if (!editor) return
    if (!person.signaturePath) {
      toast.error("У цього працівника немає підпису.")
      return
    }
    const inserted = await insertImageIntoDocument(editor, {
      id: -1,
      originalFilename: "signature",
      path: person.signaturePath,
      width: 0,
      height: 0,
    })
    if (!inserted) return

    // Читання щойно закоміченої вставки — канонічний шлях із документів
    // insertImage: «Read the committed extent back from snapshot().image
    // or getSelectedImage()». Вікно ретраїв до ~320 мс (20 кадрів) — пейнт
    // може відтягувати осідання ревізії.
    let selected: ReturnType<typeof editor.getSelectedImage> = null
    for (let attempt = 0; attempt < 20 && !selected; attempt++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      selected = editor.snapshot().image ?? editor.getSelectedImage() ?? null
    }
    console.info(LOG, "signature selected →", {
      id: selected?.id,
      wrap: selected?.wrap,
      canChangeWrap: selected?.canChangeWrap,
    })
    if (!selected) {
      toast.error(
        "Зображення вставлено, але двигун його ще не вибрав — застосуйте обгортку вручну (тулбар «Перед текстом»)."
      )
      return
    }
    const wrap = editor.exec({
      type: "setImageWrapType",
      target: "inFront",
      drawingNodeId: selected.id,
    })
    console.info(LOG, "signature wrap inFront →", {
      ok: wrap.ok,
      reason: wrap.ok ? undefined : wrap.reason,
    })
    if (!wrap.ok) {
      toast.error(
        `Зображення вставлено, але обгортку «перед текстом» не вдалося застосувати: ${wrap.reason}`
      )
    }
  }

  return (
    <>
      {/* Хром чіпів — малювальний стиль + hover-активність персональних нод */}
      <CustomNodeChrome onNodeHover={handleNodeHover} />
      {/* Плаваюча кнопка над чіпом, у його ПРАВОМУ ВЕРХНЬОМУ куті (рег: кути
          суміщуються через -translate-x-full -translate-y-full) — список
          відкривається тільки по ній */}
      {hover && (
        <button
          type="button"
          aria-label="Вибрати співробітника"
          title="Вибрати співробітника"
          className="fixed z-50 -translate-x-full -translate-y-full items-center justify-center rounded-md border bg-popover/95 p-1 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
          style={{ left: hover.left, top: hover.top }}
          onClick={() => openPicker()}
        >
          <UserRound className="size-3.5" />
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Вибрати співробітника</DialogTitle>
            <DialogDescription>
              Екземпляр {instance}: усі поля цього екземпляра прив&apos;язуються до обраної людини.
            </DialogDescription>
          </DialogHeader>
          {personnel.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Персоналу немає.</div>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-lg border border-border/50 p-1">
              {personnel.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  disabled={busy}
                  className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted disabled:opacity-50"
                  onClick={() => void bindPerson(person)}
                >
                  <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{person.fullName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {person.position} · {person.rank}
                    </span>
                  </span>
                  {busy && (
                    <Loader2 className="ml-auto mt-1 size-4 animate-spin text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
