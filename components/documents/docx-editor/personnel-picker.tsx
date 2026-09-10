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
import { normalizeImageBytes, useDocxEditor } from "@docx-editor.dev/react"
import { Loader2, UserRound } from "lucide-react"
import { toast } from "sonner"

import {
  PERSONNEL_FIELD_LABELS,
  type PersonnelEntry,
} from "@/components/documents/docx-editor/personnel-panel"
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

// Порт fillSignature з a5f8381 (перевірений старий механізм вставки підпису)
const SIGNATURE_HEIGHT_PT = 54 // висота підпису в документі, pt (≈ 4em при 14pt)
const SIGNATURE_WIDTH_MIN_PT = 24

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
  // Порт a5f8381: session-карта key → вставлені підписи (drawingId + якір-
  // абзац) — МАСИВ, бо один екземпляр може мати кілька чіпів підпису в
  // документі (той самий key staff.{i}.signature), кожен чіп — власна
  // картинка. В межах сесії дозволяє прибрати старі картинки при
  // переприв'язці; після save/load карта порожня — див. обмеження L1
  // (переліку зображень у публічному API немає).
  const sigMarkersRef = React.useRef(
    new Map<string, Array<{ drawingId: string; anchorParaId: string }>>()
  )

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
    // Старт прив'язки = переприв'язка: прибираємо ВСІ картинки попередніх
    // підписів цього екземпляра (в межах сесії), ПЕРШ ніж обробляти чіпи —
    // саме тут, а не в bindSignatureImage, щоб другий чіп того ж поля не
    // зітрив картинку першого, вставлену в цьому ж проході.
    suspendFieldSelect(true)
    try {
      const priorKeys = new Set(
        customNodesOf(editor)
          .map((node) => node.attrs as FieldChipAttrs)
          .filter((attrs) => attrs.fieldType === "signature" && attrs.personInstance === String(instance))
          .map((attrs) => attrs.key)
      )
      for (const markerKey of priorKeys) {
        const stale = sigMarkersRef.current.get(markerKey) ?? []
        for (const marker of stale) {
          const del = editor.exec({ type: "deleteImage", drawingNodeId: marker.drawingId })
          console.info(LOG, "deleteImage попереднього підпису →", {
            chipKey: markerKey,
            ok: del.ok,
            reason: del.ok ? undefined : del.reason,
          })
        }
        if (stale.length > 0) sigMarkersRef.current.delete(markerKey)
      }

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
        // Signature: якщо у людини Є підпис — вміст чіпа = один пробіл
        // (слово «Підпис (N)» зникає, replaceImage-перепис наступного
        // прив'язування зачиста стару картинку автоматично); якщо підпису
        // НЕМА — слово «Підпис (N)» повертається (без картинки).
        const update = updateCustomNode(editor, FieldNode, node.nodeId, {
          attrs: { key, p: person.id },
          text: fieldType === "signature" ? (person.signaturePath ? " " : label) : textForField(fieldType, person),
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
        // Підпис — порт fillSignature: ховається слово (setValue " "), 
        // плаваюча картинка «зліва від ПІБ» і автозаникнення при
        // переприв'язці (rewritний вміст).
        if (fieldType === "signature" && person.signaturePath) {
          if (!update.nodeId) {
            toast.error("Двигун не повернув новий id маркера підпису.")
            continue
          }
          const ok = await bindSignatureImage(person, key, update.nodeId, String(instance))
          if (!ok) continue
        }
      }
      toast.success(`Екземпляр ${instance}: персонал оновлено (${person.fullName}).`)
    } finally {
      suspendFieldSelect(false)
      setOpen(false)
      setBusy(false)
    }
  }

  // Порт fillSignature з a5f8381: маркер-чип лишається (слово ховається
  // поверховим setValue), зображення вставляється ТІЛЬКИ позаControls на
  // materialization-aware як-абзац тієї ж сторінки, що й маркер, і
  // позиціюється розрахованими EMU (зліва від ПІБ) повним аналогом старого.
  // Session-мапа sigMarkersRef дозволяє прибрати стару картинку при
  // повторній прив'язці (в межах сесії).
  async function bindSignatureImage(
    person: PersonnelEntry,
    chipKey: string,
    chipNodeId: string,
    instance: string
  ): Promise<boolean> {
    if (!editor) return false
    const surface = editor.surface
    if (!person.signaturePath || !surface) return false

    // 0) Тимчасовий пробіл замість слова «Підпис»: порожній контрол дає
    // нестабільну геометрію хрому — пробіл стабілізує вимірювання.
    const staged = surface.contentControls.setValue(chipNodeId, " ")
    if (staged !== true) {
      console.warn(LOG, "setValue пробілу відхилено →", { chipNodeId })
      toast.error("Обмеження API: не приймається запис значення поля підпису.")
      return false
    }

    // 1) fetch + normalize зображення підпису людини
    const response = await fetch(person.signaturePath)
    if (!response.ok) {
      toast.error("Не вдалося завантажити зображення підпису.")
      return false
    }
    const normalized = normalizeImageBytes(new Uint8Array(await response.arrayBuffer()))
    if (!normalized.ok) {
      toast.error("Зображення підпису не вдалося обробити.")
      return false
    }

    let ok = false
    let drawingId: string | null = null
    let currentId = ""
    try {
      // Попередні підписи цього ключа вже видалено на старті прив'язки
      // (bindPerson) — тут лише вставка нового маркера для поточного чіпа.

      // Поле ПІБ групи — для позиції «зліва від ПІБ» (актуальний id —
      // rewrite міг змінити його у цій же групі).
      const personNodeId = customNodesOf(editor).find((node) => {
        const a = node.attrs as FieldChipAttrs
        return a.fieldType === "fullName" && a.personInstance === instance
      })?.nodeId

      const heightEmu = Math.round(SIGNATURE_HEIGHT_PT * 12700)
      const widthEmu = Math.round(
        (normalized.widthPoints / Math.max(1, normalized.heightPoints)) * heightEmu
      )
      const widthPx = widthEmu / 9525
      const heightPx = heightEmu / 9525

      // Геометрія полів ДО вставки: плаваюча картинка рядок не ростить, тож
      // вимірювання залишаються валідними після wrap. Ретраї 20×25 мс.
      let pageRect: DOMRect | null = null
      let sigRect: DOMRect | null = null
      let personLefts: number[] = []
      let sigChrome: HTMLElement | null = null
      for (let attempt = 0; attempt < 20 && !pageRect; attempt++) {
        sigChrome = document.querySelector<HTMLElement>(
          `.docx-content-control-chrome[data-docx-content-control="${CSS.escape(chipNodeId)}"]`
        )
        const personChrome = personNodeId
          ? document.querySelector<HTMLElement>(
              `.docx-content-control-chrome[data-docx-content-control="${CSS.escape(personNodeId)}"]`
            )
          : null
        sigRect =
          sigChrome?.querySelector<HTMLElement>(".docx-content-control-boundary")?.getBoundingClientRect() ?? null
        const personLeftsRaw = [
          ...(personChrome?.querySelectorAll<HTMLElement>(".docx-content-control-boundary") ?? []),
        ].map((b) => b.getBoundingClientRect().left)
        // Фолбек: без ПІБ-поля групи — позиція зліва від самого поля підпису
        personLefts = personLeftsRaw.length > 0 ? personLeftsRaw : sigRect ? [sigRect.left] : []
        pageRect =
          (sigChrome?.closest(".docx-editor-page") ?? sigChrome?.closest("[class*='docx-page']"))
            ?.getBoundingClientRect() ?? null
        if (!pageRect || !sigRect || personLefts.length === 0) {
          pageRect = null
          await new Promise((resolve) => setTimeout(resolve, 25))
        }
      }
      if (!pageRect || !sigRect || personLefts.length === 0) {
        console.warn(LOG, "геометрію чіпа не знайдено у намальованому DOM")
        return false
      }

      // Якор: materialization-aware підбір абзацу сторінки чіпа (з кінця,
      // скіпаючи зайняті), тест公开发 candidacy — каретка поза контролами;
      // фолбек — глобальний walk (випадок таблиці).
      const paragraphs = [...editor.query({ type: "paragraphs" })]
      const byText = new Map<string, string[]>()
      for (const p of paragraphs) {
        if (!p.paraId) continue
        const normalizedText = p.text.trim()
        if (!normalizedText) continue
        const list = byText.get(normalizedText) ?? []
        list.push(p.paraId)
        byText.set(normalizedText, list)
      }
      const sigPage =
        sigChrome?.closest(".docx-editor-page") ?? sigChrome?.closest("[class*='docx-page']")
      const pageCandidates: string[] = []
      if (sigPage) {
        for (const el of sigPage.querySelectorAll<HTMLElement>("[data-paragraph-id]")) {
          const text = (el.textContent ?? "").trim()
          if (!text) continue
          for (const paraId of byText.get(text) ?? []) pageCandidates.push(paraId)
        }
      }
      const takenAnchors = new Set(
        [...sigMarkersRef.current.values()].flat().map((info) => info.anchorParaId)
      )
      let anchorParaId: string | null = null
      for (let i = pageCandidates.length - 1; i >= 0; i--) {
        const candidate = pageCandidates[i]
        if (takenAnchors.has(candidate)) continue
        if (!editor.exec({ type: "setSelection", anchor: { paraId: candidate } }).ok) continue
        if (!editor.query({ type: "contentControlAt" })) {
          anchorParaId = candidate
          break
        }
      }
      if (!anchorParaId) {
        // Фолбек: глобальний walk по всіх модельних абзацах (табличний
        // випадок: на сторінці поля чистих абзаців може не бути)
        for (let i = paragraphs.length - 1; i >= 0; i--) {
          const candidate = paragraphs[i].paraId
          if (!candidate || takenAnchors.has(candidate)) continue
          if (!editor.exec({ type: "setSelection", anchor: { paraId: candidate } }).ok) continue
          if (!editor.query({ type: "contentControlAt" })) {
            anchorParaId = candidate
            break
          }
        }
      }
      if (!anchorParaId) {
        console.warn(LOG, "вільний як-абзац не знайдено")
        return false
      }

      // Знімок id наявних drawing — ДО вставки (пошук нової у DOM-дифі)
      const knownIdsPre = new Set(
        [
          ...document.querySelectorAll<HTMLElement>("[data-drawing-node-id]"),
        ].map((el) => el.getAttribute("data-drawing-node-id") ?? "")
      )

      // Вставка ПОВНОГО розміру (a:ext серіалізується з розміру вставки —
      // resize в окремому комміті губив розмір), ретраї ×2×120 мс.
      const insertCommand = {
        type: "insertImage" as const,
        data: normalized.bytes,
        mime: normalized.mime,
        widthPoints: Math.max(
          SIGNATURE_WIDTH_MIN_PT,
          Math.round(
            (normalized.widthPoints / Math.max(1, normalized.heightPoints)) * SIGNATURE_HEIGHT_PT
          )
        ),
        heightPoints: SIGNATURE_HEIGHT_PT,
      }
      let result = await editor.executeImageCommand(insertCommand)
      for (let attempt = 0; !result.ok && attempt < 2; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 120))
        result = await editor.executeImageCommand(insertCommand)
      }
      if (!result.ok) {
        console.warn(LOG, "insertImage відхилено →", { reason: result.reason })
        return false
      }

      // Id вставленого drawing: виділення або короткий DOM-диф
      drawingId = editor.getSelectedImage()?.id ?? null
      for (let attempt = 0; attempt < 8 && !drawingId; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 25))
        drawingId =
          editor.getSelectedImage()?.id ??
          [
            ...document.querySelectorAll<HTMLElement>("[data-drawing-node-id]"),
          ]
            .map((el) => el.getAttribute("data-drawing-node-id") ?? "")
            .find((id) => id && !knownIdsPre.has(id)) ??
          null
      }
      if (!drawingId) {
        console.warn(LOG, "id вставленого drawing не знайдено")
        return false
      }
      currentId = drawingId

      // «Перед текстом» — ОКРЕМИЙ крок ДО resize: конвертація inline →
      // anchored перезаписує a:ext — resize в тому ж кроці губиться; і саме
      // через surface.applyDrawingOps setDrawingWrap inline→anchored
      // (публічна exec-команда setImageWrapType вимагає kind==='anchored').
      const knownIds = new Set(
        [
          ...document.querySelectorAll<HTMLElement>("[data-drawing-node-id]"),
        ]
          .map((el) => el.getAttribute("data-drawing-node-id") ?? "")
          .filter((id) => id !== currentId)
      )
      const wrapped = surface.applyDrawingOps([
        { op: "setDrawingWrap", drawingNodeId: currentId, wrap: "inFront" },
      ])
      if (!wrapped.committed || wrapped.rejected) {
        console.warn(LOG, "setDrawingWrap не коммітився →", { reason: wrapped.reason })
        toast.error(`Не вдалося застосувати обгортку «перед текстом».`)
        return false
      }
      // Конвертація може змінити id вузла — перезнаходимо після wrap
      const freshId = [
        ...document.querySelectorAll<HTMLElement>("[data-drawing-node-id]"),
      ]
        .map((el) => el.getAttribute("data-drawing-node-id") ?? "")
        .find((id) => !knownIds.has(id))
      if (freshId) {
        drawingId = freshId
        currentId = freshId
      }

      // Позиція «зліва від ПІБ». Горизонталь — завжди сторінково; вертикаль —
      // від ЯК-АБЗАЦУ (основна; переноситься між рендерерами без дрейфу),
      // сторінкова — фолбек.
      const pageXEmu = Math.max(
        0,
        Math.round((Math.min(...personLefts) - 4 - widthPx - pageRect.left) * 9525)
      )
      const imageTopPx = sigRect.top + sigRect.height / 2 - heightPx / 2
      const pageYEmu = Math.max(0, Math.round((imageTopPx - pageRect.top) * 9525))

      let paragraphYEmu: number | null = null
      const paraEls = [...document.querySelectorAll<HTMLElement>("[data-paragraph-id]")]
      const anchorTops = paraEls
        .filter((el) => el.getAttribute("data-paragraph-id") === anchorParaId)
        .map((el) => el.getBoundingClientRect().top)
      if (anchorTops.length > 0) {
        const anchorTop = Math.min(...anchorTops)
        paragraphYEmu = Math.round((imageTopPx - anchorTop) * 9525)
      }

      const positionOnce = (
        verticalEmu: number,
        relativeToV: "page" | "paragraph"
      ) =>
        surface.applyDrawingOps([
          {
            op: "positionDrawing",
            drawingNodeId: currentId,
            position: {
              horizontalEmu: pageXEmu,
              relativeToH: "page",
              verticalEmu,
              relativeToV,
            },
          },
        ])
      const refreshId = () => {
        const fresh = [
          ...document.querySelectorAll<HTMLElement>("[data-drawing-node-id]"),
        ]
          .map((el) => el.getAttribute("data-drawing-node-id") ?? "")
          .find((id) => !knownIds.has(id))
        if (fresh) {
          drawingId = fresh
          currentId = fresh
        }
      }
      const confirmRendered = async () => {
        for (let attempt = 0; attempt < 5; attempt++) {
          if (document.querySelector(`[data-drawing-node-id="${CSS.escape(currentId)}"]`) !== null)
            return true
          await new Promise((resolve) => setTimeout(resolve, 60))
        }
        return false
      }
      const tryPosition = async (
        verticalEmu: number,
        relativeToV: "page" | "paragraph",
        attempts: number
      ) => {
        for (let attempt = 0; attempt < attempts; attempt++) {
          const applied = positionOnce(verticalEmu, relativeToV)
          refreshId()
          if (!applied.committed || applied.rejected) {
            await new Promise((resolve) => setTimeout(resolve, 250))
            continue
          }
          if (await confirmRendered()) return true
        }
        return false
      }

      let positioned =
        paragraphYEmu !== null ? await tryPosition(paragraphYEmu, "paragraph", 4) : false
      if (!positioned) {
        positioned = await tryPosition(pageYEmu, "page", 6)
      }
      if (!positioned) {
        console.warn(LOG, "позиціювання підпису не підтвердилось render'ом")
        toast.error("Зображення вставлено, але позиціювання не вдалося підтвердити.")
        return false
      }

      // Ховаємо назву поля («Підпис (N)») — картинка її замінила
      surface.contentControls.setValue(chipNodeId, "")
      sigMarkersRef.current.set(chipKey, [
        ...(sigMarkersRef.current.get(chipKey) ?? []),
        { drawingId: currentId, anchorParaId },
      ])
      ok = true
      return true
    } finally {
      if (!ok) {
        // Невдале заповнення: прибираємо щойно вставлену картинку; слово
        // не повертаємо — контрол лишається порожнім (чистий друк/експорт)
        if (drawingId) {
          const del = editor.exec({ type: "deleteImage", drawingNodeId: drawingId })
          console.info(LOG, "failure cleanup deleteImage →", { ok: del.ok })
        }
        surface.contentControls.setValue(chipNodeId, "")
      }
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
