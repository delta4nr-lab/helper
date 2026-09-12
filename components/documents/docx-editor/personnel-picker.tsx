"use client"

// Прив'язка персоналу та курсантів до персональних чіпів (FieldNode):
// компактна КРУГЛА кнопка-пікер біля чіпа (через публічний
// <CustomNodeChrome onNodeHover> + node.rect) — старий quickPick-дизайн
// (порт 10985f0): кнопка відкриває PersonPicker-попап із пошуком за ПІБ
// і позиції/звання в рядках (клік по чіпу — звичайний потік
// виділення/редагування вмісту). Flavor чіпа (staff.{i}.* / cadet.{i}.*)
// вирішує джерело списку: штат або курсанти активного курсу.
// Вибір людини/курсанта групово прив'язує ВСІ ноди того самого
// personInstance публічним updateCustomNode: data зберігає
// key/fieldType/personInstance і ОНОВЛЮЄ personnelId; актуальний nodeId
// береться лише з результату операції (rewrite замінює контрол, і старий
// id далі не резолвиться). Футер попапа дозволяє «зняти особу» (unbind).
// Підказка при виборі вставляється як РЕАЛЬНЕ зображення (повний пайплайн)
// і виноситься обгорткою «перед текстом»; сама нода лишається логічним
// полем (§12).

import * as React from "react"
import { CustomNodeChrome } from "@docx-editor.dev/pro/react"
import type { ActivatedCustomNode } from "@docx-editor.dev/pro"
import { customNodesOf, decodeCustomNodeTag, updateCustomNode } from "@docx-editor.dev/pro"
import { normalizeImageBytes, useDocxEditor } from "@docx-editor.dev/react"
import { UserRoundSearch } from "lucide-react"
import { toast } from "sonner"

import {
  PERSONNEL_FIELD_LABELS,
  type PersonnelEntry,
} from "@/components/documents/docx-editor/personnel-panel"
import { PersonPicker, type PersonPickerItem } from "@/components/documents/person-picker"
import { suspendFieldSelect } from "@/components/documents/docx-editor/field-select"
import { useDocumentRuntime } from "@/components/documents/docx-editor/runtime/use-document-runtime"
import { FieldNode, encodeFieldChipAttrs, type FieldChipAttrs } from "@/lib/docx-editor/field-node"
import {
  COURSE_FIELD_LABELS,
  type CourseRecordData,
} from "@/lib/courses/types"

const LOG = "[personnel-picker]"

// Чіп FieldNode (identity за тегом acme:field). Два flavor-и в ключі:
// staff.{i}.{f} — персонал; cadet.{i}.{f} — курсанти (з активного курсу).
// Ручні поля (лише key) — не розпізнаються.
export type ChipFlavor = "staff" | "cadet"

// Порт fillSignature з a5f8381 (перевірений старий механізм вставки підпису)
const SIGNATURE_HEIGHT_PT = 54 // висота підпису в документі, pt (≈ 4em при 14pt)
const SIGNATURE_WIDTH_MIN_PT = 24

// Єдиний розбір персонального чіпа (hover/reposition/popup — одна точка
// парсингу): регекс схеми key /^(staff|cadet)\.(\d+)\./; фолбек на читання
// attrs з документа за канонічним id, бо hover-Activation не завжди несе
// attrs (матч за тегом був би завжди першою нодою). Ручні поля (лише key)
// — null.
export function resolvePersonField(
  editor: NonNullable<ReturnType<typeof useDocxEditor>>,
  node: Pick<ActivatedCustomNode, "tag" | "attrs" | "nodeId">
): { nodeId: string; flavor: ChipFlavor; instance: number; fieldType: string } | null {
  const decoded = decodeCustomNodeTag(node.tag)
  if (!(decoded?.prefix === FieldNode.tagPrefix && decoded.name === FieldNode.name)) return null
  let attrs = node.attrs as FieldChipAttrs
  if (!attrs.fieldType || !attrs.personInstance) {
    const match = customNodesOf(editor).find((candidate) => candidate.nodeId === node.nodeId)
    attrs = (match?.attrs ?? attrs) as FieldChipAttrs
  }
  if (!attrs.fieldType || !attrs.personInstance) return null
  const flavor: ChipFlavor = attrs.key.startsWith("cadet.") ? "cadet" : "staff"
  return {
    nodeId: node.nodeId ?? "",
    flavor,
    instance: Number(attrs.personInstance),
    fieldType: attrs.fieldType,
  }
}

// Внутрішній UI-ключ екземпляра: не змінює формат DOCX attrs/key —
// лише розділяє staff і cadet лічильники як окремі слоти стану
function instanceKey(flavor: ChipFlavor, instance: number): string {
  return `${flavor}:${instance}`
}

// Людська назва поля за flavor-ом чіпа (для тостів/unbind)
function fieldLabel(flavor: ChipFlavor, fieldType: string): string {
  if (flavor === "cadet") return COURSE_FIELD_LABELS[fieldType as keyof typeof COURSE_FIELD_LABELS] ?? "Поле"
  return PERSONNEL_FIELD_LABELS[fieldType as keyof typeof PERSONNEL_FIELD_LABELS] ?? "Поле"
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

export function PersonnelChrome({
  personnel,
  cadets,
}: {
  personnel: PersonnelEntry[]
  cadets?: readonly CourseRecordData[]
}) {
  const editor = useDocxEditor()
  // Runtime v1 — джерело низькорівневих читань (зокрема paragraphId ноди
  // підпису для її якоря; без setSelection-probe)
  const runtime = useDocumentRuntime()
  // Єдиний стан активного поля (hover-контролер): логічна identity =
  // nodeId + flavor + instance; rect — лише щойна геометрія для
  // позиції кнопки (rect НЕ є identity — не ремонтую кнопку на рух
  // курсора по чіпу). Замінює колишні float(left/top/instance/flavor/chipNodeId).
  const [activeField, setActiveField] = React.useState<{
    nodeId: string
    flavor: ChipFlavor
    instance: number
    fieldType: string
    rect: DOMRect
  } | null>(null)
  // open — відкритий попап: доки відкритий, «плаваюча» кнопка лишається
  // на місці навіть коли курсор пішов з чіпа (порт quickPick 10985f0).
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  // Обрані люди по екземплярах (для галочки в попапі): `${flavor}:${instance}` → person.id
  const [selectedByInstance, setSelectedByInstance] = React.useState<Record<string, string>>({})
  // Порт a5f8381: session-карта key → вставлені підписи (drawingId + якір-
  // абзац) — МАСИВ, бо один екземпляр може мати кілька чіпів підпису в
  // документі (той самий key staff.{i}.signature), кожен чіп — власна
  // картинка. В межах сесії дозволяє прибрати старі картинки при
  // переприв'язці; після save/load карта порожня — див. обмеження L1
  // (переліку зображень у публічному API немає).
  const sigMarkersRef = React.useRef(
    new Map<string, Array<{ drawingId: string; anchorParaId: string }>>()
  )

  // Єдина точка закриття попапа + скидання якоря.
  const closePicker = React.useCallback(() => {
    setOpen(false)
    setActiveField(null)
  }, [])

  // Видаляє ВСІ session-підписи екземпляра — мульти-видалення для
  // дубльованих груп: декілька чіпів можуть мати один і той самий key
  // (staff.{i}.signature), і кожен з них тримає власний drawing у масиві
  // карти. Матч за КЛЮЧЕМ-СХЕМОЮ (не за attrs нод), щоб не залежати від
  // того, як рушій віддає attrs. Повертає видалені ключі (діагностика).
  function deleteSignatureMarkersForInstance(instanceId: string): string[] {
    if (!editor) return []
    const pattern = new RegExp(`^(staff|cadet)\\.${instanceId}\\.signature$`)
    const deletedKeys: string[] = []
    for (const [key, markers] of sigMarkersRef.current) {
      if (!pattern.test(key)) continue
      for (const marker of markers) {
        editor.exec({ type: "deleteImage", drawingNodeId: marker.drawingId })
      }
      sigMarkersRef.current.delete(key)
      deletedKeys.push(key)
    }
    return deletedKeys
  }

  function handleNodeHover(node: ActivatedCustomNode) {
    // Якщо попап «залип» відкритим без якоря — скидаємо й даємо hover
    // відпрацювати (захист від стану, коли кнопка більше не з'являється).
    if (open) {
      if (activeField) return
      setOpen(false)
    }
    const info = editor ? resolvePersonField(editor, node) : null
    if (!info) {
      // Компонент не докладає подій «виходу» курсора з чіпа — приховування
      // робить pointerleave-случач нижче (порт старого quickPick 10985f0)
      return
    }
    // Identity: nodeId + flavor + instance. Той самий чіп (повторний hover,
    // рух курсора) — лише мердж свіжої геометрії: кнопка не ремонтується,
    // анімація знову не грає; rect НЕ є identity
    if (
      activeField &&
      activeField.nodeId === info.nodeId &&
      activeField.flavor === info.flavor &&
      activeField.instance === info.instance
    ) {
      setActiveField((prev) => (prev ? { ...prev, rect: node.rect } : prev))
      return
    }
    // Позиція «праворуч від рамки поля» зі старого quickPick: rect.right + 6,
    // вертикально по центру рамки (translate-клас біля позиції в JSX)
    setActiveField({
      nodeId: info.nodeId,
      flavor: info.flavor,
      instance: info.instance,
      fieldType: info.fieldType,
      rect: node.rect,
    })
  }

  // Таймер приховування кнопки: курсор пішов із чіпа/кнопки — кнопка гасне
  // із затримкою 200 мс (порт quickPick 10985f0: час на «переповзти» через
  // 6px проміжок); відкритий попап тримає кнопку
  const hideTimer = React.useRef<number | null>(null)
  const clearHideTimer = React.useCallback(() => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }, [])
  const scheduleHide = React.useCallback(() => {
    // Поки попап відкритий або триває прив'язка — кнопку не ховаємо: попап
    // рендериться в порталі, тож перехід у список дає хибний pointerleave
    // на контейнері кнопки.
    if (open || busy) return
    clearHideTimer()
    hideTimer.current = window.setTimeout(() => {
      hideTimer.current = null
      setActiveField(null)
    }, 200)
  }, [open, busy, clearHideTimer])

  // Видалення кнопки при виході курсора з чіпа: CustomNodeChrome не подає
  // подій «leave», тому pointerleave вішаємо на хром активного чіпа;
  // відкритий попап (open) і хід прив'язки (busy) тримають кнопку.
  // Залежність — лише nodeId: об'єкт activeField міняється на кожен рух
  // курсора по чіпу (оновлення rect), а слухач потрібен тільки на
  // конкретному вузлі — перевішуємо лише при переході на інший чіп.
  const activeNodeId = activeField?.nodeId
  React.useEffect(() => {
    if (!activeNodeId || open || busy) return
    const chrome = document.querySelector<HTMLElement>(
      `.docx-content-control-chrome[data-docx-content-control="${CSS.escape(activeNodeId)}"]`
    )
    if (!chrome) return
    chrome.addEventListener("pointerleave", scheduleHide)
    return () => chrome.removeEventListener("pointerleave", scheduleHide)
  }, [activeNodeId, open, busy, scheduleHide])

  // Таймер не має лишатися після розмонтування.
  React.useEffect(() => () => clearHideTimer(), [clearHideTimer])

  // Список для пікера за flavor-ом чіпа: зі штату або з активного курсу
  const pickerItems: PersonPickerItem[] = React.useMemo(() => {
    if (activeField?.flavor === "cadet") {
      return (cadets ?? []).map((r) => ({
        id: r.id,
        name:
          r.fullName ||
          [r.lastName, r.firstName].filter(Boolean).join(" ") ||
          "Курсант",
        position: r.position ?? "",
        rank: r.rank ?? "",
      }))
    }
    return personnel.map((p) => ({
      id: p.id,
      name: p.fullName,
      position: p.position,
      rank: p.rank,
    }))
  }, [activeField?.flavor, personnel, cadets])

  // Перепозиціювання відкритого попапа при скролі viewport: кнопку тримаємо
  // біля ПІБ-чіпа групи (якщо чіп пішов з paint-шару — попап закривається)
  const activeInstance = activeField?.instance
  const activeFlavor = activeField?.flavor
  React.useEffect(() => {
    if (!open || activeInstance == null || !editor) return
    const viewport = document.querySelector<HTMLElement>(".docx-editor-one-surface__viewport")
    const reposition = () => {
      const personNode = customNodesOf(editor)
        .map((node) => resolvePersonField(editor, node))
        .find(
          (field) =>
            field != null &&
            field.flavor === activeFlavor &&
            field.instance === activeInstance &&
            // Позицію кнопки ведемо біля ПІБ-чіпа групи (як і раніше)
            field.fieldType === "fullName"
        )
      const rect = personNode
        ? document
            .querySelector<HTMLElement>(
              `.docx-content-control-chrome[data-docx-content-control="${CSS.escape(personNode.nodeId)}"] .docx-content-control-boundary`
            )
            ?.getBoundingClientRect()
        : null
      if (!rect || rect.width === 0) {
        setOpen(false)
        setActiveField(null)
        return
      }
      // Merдж лише геометрії — логічна identity поля не змінюється
      setActiveField((prev) => (prev ? { ...prev, rect } : prev))
    }
    viewport?.addEventListener("scroll", reposition, { passive: true })
    return () => viewport?.removeEventListener("scroll", reposition)
    // [activeFlavor, activeInstance] — логічна identity групи, а не об'єкт
    // геометрії; поки попап відкритий, hover не рухає кнопку (open-guard)
  }, [open, activeInstance, activeFlavor, editor])

  // Групове оновлення (§13): тільки існуючі ноди цього personInstance, без
  // створення відсутніх. Актуальний nodeId — тільки з результату операції
  // (updateCustomNode замінює контрол, і старий id далі не резолвиться).
  async function bindPerson(person: PersonnelEntry, instanceId: string) {
    if (!editor || !instanceId) return
    setBusy(true)
    // Старт прив'язки = переприв'язка: прибираємо ВСІ картинки попередніх
    // підписів цього екземпляра (в межах сесії), ПЕРШ ніж обробляти чіпи —
    // саме тут, а не в bindSignatureImage, щоб другий чіп того ж поля не
    // зітрив картинку першого, вставлену в цьому ж проході.
    suspendFieldSelect(true)
    try {
      // Мульти-видалення: прибираємо ВСІ картинки підписів цього екземпляра
      // (у т.ч. в дубльованих групах з тим самим key), ПЕРШ ніж обробляти
      // чіпи — щоб другий чіп того ж поля не зітрив картинку першого.
      const deletedKeys = deleteSignatureMarkersForInstance(String(instanceId))
      const signatureNodes = customNodesOf(editor).filter((node) => {
        const attrs = node.attrs as FieldChipAttrs
        return (
          attrs.fieldType === "signature" && attrs.personInstance === String(instanceId)
        )
      })
      console.info(LOG, "signature cleanup (bindPerson) →", {
        instance: instanceId,
        duplicateSignatureNodes: signatureNodes.length,
        deletedKeys,
      })

      const nodes = customNodesOf(editor).filter((node) => {
        const attrs = node.attrs as FieldChipAttrs
        return (
          attrs.fieldType != null && attrs.personInstance === String(instanceId)
        )
      })
      if (nodes.length === 0) {
        toast.error(`Поле екземпляра ${instanceId} у документі не знайдено.`)
        return
      }
      // Вставку підпису відкладаємо на КІНЕЦЬ циклу: updateCustomNode для
      // сусідніх полів групи (ПІБ/посада/звання) переписує той самий абзац і
      // зніс би щойно вставлений anchored-drawing. Робимо всі rewrite'и ->
      // потім вставляємо зображення (більше нічого в абзаці не переписується).
      const pendingSignatures: Array<{
        key: string
        nodeId: string
      }> = []
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
          // логічний key без змін; фізичне кодування attr (k) — єдина точка
          attrs: encodeFieldChipAttrs(key, person.id),
          text: fieldType === "signature" ? (person.signaturePath ? " " : label) : textForField(fieldType, person),
        })
        if (!update.ok) {
          toast.error(update.reason ?? `Не вдалося оновити поле «${label}».`)
          continue
        }
        // Підпис — окремий flow (insertImage→wrap→position). Якщо в картці
        // людини немає підпису — НЕ мовчимо (раніше це був тихий пропуск).
        if (fieldType === "signature") {
          if (!person.signaturePath) {
            toast.warning(`У ${person.fullName} немає підпису в картці персоналії`)
            continue
          }
          if (!update.nodeId) {
            toast.error("Двигун не повернув новий id маркера підпису.")
            continue
          }
          pendingSignatures.push({ key, nodeId: update.nodeId })
        }
      }
      // Усі rewrite'и групи завершено — тепер вставляємо підписи.
      for (const pending of pendingSignatures) {
        await bindSignatureImage(person, pending.key, pending.nodeId)
      }
      toast.success(`Екземпляр ${instanceId}: персонал оновлено (${person.fullName}).`)
    } finally {
      // Галочка в попапі — за єдиним ключем flavor:instance
      setSelectedByInstance((prev) => ({
        ...prev,
        [instanceKey("staff", Number(instanceId))]: person.id,
      }))
      suspendFieldSelect(false)
      closePicker()
      setBusy(false)
    }
  }

  // Прив'язка курсанта (cadet.{i}.{f}-чипи + активний курс) — порт
  // fbcf076 без змін поведінки: той самий патерн групового оновлення;
  // значення — з відповідної колонки запису (orderNumber → рядок);
  // ПОРОЖНЯ колонка — маркер лишається (текст не чіпаємо). Підписів у
  // курсантів немає (CourseRecord без зображень).
  function bindCadet(cadet: CourseRecordData, instanceId: string) {
    if (!editor || !instanceId) return
    setBusy(true)
    suspendFieldSelect(true)
    try {
      const nodes = customNodesOf(editor).filter((node) => {
        const attrs = node.attrs as FieldChipAttrs
        return (
          attrs.key?.startsWith(`cadet.${instanceId}.`) === true &&
          attrs.personInstance === String(instanceId)
        )
      })
      if (nodes.length === 0) {
        toast.error(`Поле екземпляра ${instanceId} у документі не знайдено.`)
        return
      }
      for (const node of nodes) {
        const attrs = node.attrs as FieldChipAttrs
        const key = attrs.key ?? ""
        const fieldType = key.slice(`cadet.${instanceId}.`.length) || ""
        const label = fieldLabel("cadet", fieldType)
        const value = cadetFieldValue(fieldType, cadet)
        // Fix A: engine-перезапис identity ВИМАГАЄ непорожній text
        // (insertInlineContentControl → invalid-property-value на порожньому).
        // Порожня колонка → дефолтний label поля, як при unbind, з (N).
        const text = value ? value : `${label} (${instanceId})`
        // identity: логічний key зберігається; p = record.id (повний id);
        // фізичне кодування attr (k) — єдина точка encodeFieldChipAttrs
        const update = updateCustomNode(editor, FieldNode, node.nodeId, {
          attrs: encodeFieldChipAttrs(key, cadet.id),
          text,
        })
        if (!update.ok) {
          toast.error(update.reason ?? `Не вдалося оновити поле «${label}».`)
        }
      }
      const display =
        cadet.fullName ??
        [cadet.lastName, cadet.firstName].filter(Boolean).join(" ") ??
        "курсант"
      toast.success(`Екземпляр ${instanceId}: курсант прив'язаний (${display}).`)
    } finally {
      // Галочка в попапі — за єдиним ключем flavor:instance
      setSelectedByInstance((prev) => ({
        ...prev,
        [instanceKey("cadet", Number(instanceId))]: cadet.id,
      }))
      suspendFieldSelect(false)
      closePicker()
      setBusy(false)
    }
  }

  // значення поля курсанта з запису активного курсу (orderNumber → рядок)
  function cadetFieldValue(fieldType: string, cadet: CourseRecordData): string {
    const raw = (cadet as unknown as Record<string, string | number | null>)[fieldType] ?? null
    return raw == null ? "" : String(raw)
  }

  // «Зняти особу» (футер попапа): видаляємо картинкі підписів екземпляра
  // (session-мапа) і повертаємо чіпи до назв полів («ПІБ (N)»), personnelId
  // з тега прибирається оновленням identity без p.
  function unbindPerson(instanceId: string, flavor: ChipFlavor) {
    if (!editor) return
    suspendFieldSelect(true)
    try {
      // Мульти-видалення: знімаємо ВСІ картинки підписів екземпляра,
      // включно з дубльованими групами (той самий key).
      const deletedKeys = deleteSignatureMarkersForInstance(String(instanceId))
      const nodes = customNodesOf(editor).filter((node) => {
        const attrs = node.attrs as FieldChipAttrs
        return attrs.fieldType != null && attrs.personInstance === String(instanceId)
      })
      console.info(LOG, "signature cleanup (unbindPerson) →", {
        instance: instanceId,
        deletedKeys,
      })
      for (const node of nodes) {
        const attrs = node.attrs as FieldChipAttrs
        const fieldType = attrs.fieldType ?? ""
        const key = attrs.key ?? ""
        const label = fieldLabel(key.startsWith("cadet.") ? "cadet" : "staff", fieldType)
        updateCustomNode(editor, FieldNode, node.nodeId, {
          // attrs заміняється цілком: без p personnelId прибирається з тега
          attrs: { key },
          text: label,
        })
      }
      // Галочка в попапі знімається за єдиним ключем flavor:instance
      setSelectedByInstance((prev) => {
        const next = { ...prev }
        delete next[instanceKey(flavor, Number(instanceId))]
        return next
      })
      toast.success(`Екземпляр ${instanceId}: особу знято.`)
    } finally {
      suspendFieldSelect(false)
      closePicker()
      setBusy(false)
    }
  }

  // Підпис — плаваюче зображення «перед текстом» (рухомий anchored drawing).
  // Інлайн-вставка через engine image-intent lane, далі окремі кроки:
  //   insertImage → setDrawingWrap:"inFront" (id може змінитись — DOM-диф) →
  //   positionDrawing (relativeToV: paragraph, фолбек page) → confirmRendered.
  // ЯКІР вставки — рідний абзац ноди (Runtime v1:
  // locator.node(chipNodeId).location) — без текст-пошуку й setSelection-probe.
  // Геометрія DOM потрібна лише для піксельних координат позиції. Чіп
  // ховається ПІСЛЯ позиціювання (anchored поза контролом — setValue його не
  // знищує).
  async function bindSignatureImage(
    person: PersonnelEntry,
    chipKey: string,
    chipNodeId: string
  ): Promise<boolean> {
    if (!editor || !person.signaturePath) return false
    const surface = editor.surface
    if (!surface) {
      console.warn(LOG, "signature bind skipped →", { reason: "no-surface" })
      return false
    }

    // Кроку setValue(" ") тут НЕМАЄ: bindPerson уже виставив вміст чіпа в
    // пробіл через updateCustomNode, а додатковий rewrite контрола під час
    // фази вставки переписав би абзац і зніс drawing попереднього підпису
    // групи (кілька підписів в одному абзаці).

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
      // Якір вставки — рідний абзац ноди (канонічний id + offset).
      const chipLocation = runtime?.locator.node(chipNodeId)?.location ?? null
      const anchorParaId: string | null = chipLocation?.paragraphId ?? null
      const anchorOffset: number | null = chipLocation?.paragraphOffset ?? null
      if (!anchorParaId || anchorOffset === null) {
        console.warn(LOG, "Runtime не визначив paragraphId/offset ноди підпису", {
          chipNodeId,
          anchorParaId,
          anchorOffset,
        })
        return false
      }

      // 2) Каретка — точка вставки (paragraphId+offset з Runtime, не probe).
      const caret = editor.exec({
        type: "setSelection",
        range: {
          anchor: { paragraphId: anchorParaId, offset: anchorOffset },
          head: { paragraphId: anchorParaId, offset: anchorOffset },
        },
      })
      if (!caret.ok) {
        console.warn(LOG, "не вдалося поставити каретку у signature node →", {
          reason: caret.reason,
        })
        return false
      }
      surface.flushPendingInput()

      // Знімок id наявних drawing — ДО вставки: у DOM-дифі шукаємо саме
      // щойно вставлене зображення (виділення при кількох drawings ненадійне).
      const knownIdsPre = new Set(
        [...document.querySelectorAll<HTMLElement>("[data-drawing-node-id]")].map(
          (el) => el.getAttribute("data-drawing-node-id") ?? ""
        )
      )
      const findNewDrawingId = (): string | null =>
        [...document.querySelectorAll<HTMLElement>("[data-drawing-node-id]")]
          .map((el) => el.getAttribute("data-drawing-node-id") ?? "")
          .find((id) => id !== "" && !knownIdsPre.has(id)) ?? null

      // 3) Штатна вставка зображення у каретку (engine image-intent lane).
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
      let insertResult = await editor.executeImageCommand(insertCommand)
      for (let attempt = 0; !insertResult.ok && attempt < 2; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 120))
        insertResult = await editor.executeImageCommand(insertCommand)
      }
      if (!insertResult.ok) {
        console.warn(LOG, "executeImageCommand(insertImage) відхилено →", {
          reason: insertResult.reason,
        })
        return false
      }

      // 4) id вставленого drawing — DOM-диф (нове зображення) з пріоритетом;
      // виділення беремо лише якщо воно теж не належало документу до вставки.
      for (let attempt = 0; attempt < 8 && !drawingId; attempt++) {
        const selected = editor.getSelectedImage()?.id ?? null
        drawingId =
          findNewDrawingId() ?? (selected && !knownIdsPre.has(selected) ? selected : null)
        if (!drawingId) await new Promise((resolve) => setTimeout(resolve, 25))
      }
      if (!drawingId) {
        console.warn(LOG, "id вставленого drawing не знайдено", {
          knownBefore: [...knownIdsPre],
        })
        return false
      }
      currentId = drawingId

      // 5) «Перед текстом» — через офіційний image-intent API
      // (applyImageProperties), а не сирі tree-op: атомарна транзакція
      // реєструє drawing у моделі пакунка. Конвертація inline→anchored може
      // змінити id вузла — беремо id із результату.
      const knownIds = new Set(
        [...document.querySelectorAll<HTMLElement>("[data-drawing-node-id]")]
          .map((el) => el.getAttribute("data-drawing-node-id") ?? "")
          .filter((id) => id !== currentId)
      )
      const refreshId = () => {
        const fresh = [...document.querySelectorAll<HTMLElement>("[data-drawing-node-id]")]
          .map((el) => el.getAttribute("data-drawing-node-id") ?? "")
          .find((id) => !knownIds.has(id))
        if (fresh) {
          drawingId = fresh
          currentId = fresh
        }
      }
      const wrapped = surface.applyImageProperties({
        drawingNodeId: currentId,
        hyperlink: null,
        ops: [{ op: "setDrawingWrap", drawingNodeId: currentId, wrap: "inFront" }],
      })
      if (!wrapped.ok) {
        console.warn(LOG, "setDrawingWrap не закомітився →", { reason: wrapped.reason })
        toast.error("Не вдалося застосувати обгортку «перед текстом».")
        return false
      }
      if (wrapped.drawingNodeId) {
        drawingId = wrapped.drawingNodeId
        currentId = wrapped.drawingNodeId
      } else {
        refreshId()
      }

      // 6) Геометрія: x — правий край зображення по лівому краю поля підпису
      // (зображення ЛІВОРУЧ від ноди); y — центр лінії поля
      // (relativeToV: абзац чіпа, фолбек — сторінка).
      const heightPx = (SIGNATURE_HEIGHT_PT * 12700) / 9525
      const widthPx =
        heightPx * (normalized.widthPoints / Math.max(1, normalized.heightPoints))

      let pageRect: DOMRect | null = null
      let sigRect: DOMRect | null = null
      let sigChrome: HTMLElement | null = null
      for (let attempt = 0; attempt < 20; attempt++) {
        sigChrome = document.querySelector<HTMLElement>(
          `.docx-content-control-chrome[data-docx-content-control="${CSS.escape(chipNodeId)}"]`
        )
        sigRect =
          sigChrome
            ?.querySelector<HTMLElement>(".docx-content-control-boundary")
            ?.getBoundingClientRect() ?? null
        pageRect =
          (sigChrome?.closest(".docx-editor-page") ?? sigChrome?.closest("[class*='docx-page']"))
            ?.getBoundingClientRect() ?? null
        if (pageRect && sigRect) break
        pageRect = null
        await new Promise((resolve) => setTimeout(resolve, 25))
      }
      if (!pageRect || !sigRect) {
        console.warn(LOG, "геометрію чіпа підпису не знайдено у DOM")
        return false
      }

      // x — правий край зображення притиснутий до лівого краю поля, тобто
      // зображення стоїть ЛІВОРУЧ від ноди підпису
      const pageXEmu = Math.max(
        0,
        Math.round((sigRect.left - widthPx - pageRect.left) * 9525)
      )
      const imageTopPx = sigRect.top + sigRect.height / 2 - heightPx / 2
      const pageYEmu = Math.max(0, Math.round((imageTopPx - pageRect.top) * 9525))

      let paragraphYEmu: number | null = null
      const anchorTops = [...document.querySelectorAll<HTMLElement>("[data-paragraph-id]")]
        .filter((el) => el.getAttribute("data-paragraph-id") === anchorParaId)
        .map((el) => el.getBoundingClientRect().top)
      if (anchorTops.length > 0) {
        paragraphYEmu = Math.round((imageTopPx - Math.min(...anchorTops)) * 9525)
      }

      const confirmRendered = async () => {
        for (let attempt = 0; attempt < 5; attempt++) {
          if (
            document.querySelector(`[data-drawing-node-id="${CSS.escape(currentId)}"]`) !== null
          ) {
            return true
          }
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
          const applied = surface.applyImageProperties({
            drawingNodeId: currentId,
            hyperlink: null,
            ops: [
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
            ],
          })
          if (!applied.ok) {
            await new Promise((resolve) => setTimeout(resolve, 250))
            continue
          }
          if (applied.drawingNodeId) {
            drawingId = applied.drawingNodeId
            currentId = applied.drawingNodeId
          } else {
            refreshId()
          }
          if (await confirmRendered()) return true
        }
        return false
      }

      let positioned =
        paragraphYEmu !== null ? await tryPosition(paragraphYEmu, "paragraph", 4) : false
      if (!positioned) positioned = await tryPosition(pageYEmu, "page", 6)
      if (!positioned) {
        console.warn(LOG, "позиціювання підпису не підтвердилось рендером")
        toast.error("Зображення вставлено, але позиціювання не вдалося підтвердити.")
        return false
      }

      // 7) Назву поля вже приховано пробілом (updateCustomNode у bindPerson).
      // Деструктивний setValue("") не викликаємо — setContentControlValue має
      // replacesContent:true і discarded-каскад по нащадках контрола.
      sigMarkersRef.current.set(chipKey, [
        ...(sigMarkersRef.current.get(chipKey) ?? []),
        { drawingId: currentId, anchorParaId },
      ])
      ok = true
      return true
    } finally {
      if (!ok) {
        // Невдале заповнення: прибираємо щойно вставлений drawing; слово
        // не повертаємо — контрол лишається порожнім (чистий друк/експорт)
        if (drawingId) {
          const del = surface.deleteImage(drawingId)
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
      {/* Кругла кнопка-пікер біля чіпа (порт quickPick 10985f0): відкриває
          попап зі списком персоналу з пошуком; поки попап відкритий, кнопка
          лишається на місці (hover не ховає її). Позиція — з activeField.rect
          (identity поля — nodeId+flavor+instance) */}
      {activeField && (
        <div
          className="fixed z-50 -translate-y-1/2"
          style={{
            left: activeField.rect.right + 6,
            top: activeField.rect.top,
          }}
          // Курсор на кнопці — скасовує приховування; пішов з кнопки —
          // scheduleHide знову планує гаснення через 200 мс
          onPointerEnter={clearHideTimer}
          onPointerLeave={open ? undefined : scheduleHide}
        >
          <PersonPicker
            compact
            open={open}
            onOpenChange={(next) => {
              if (next) {
                // Відкритий список тримає кнопку: таймер приховування скидаємо
                clearHideTimer()
                setOpen(true)
                return
              }
              if (busy) {
                // Закриття під час прив'язки — якір скине finally відповідної дії
                setOpen(false)
                return
              }
              // Закриття попапа → кнопка зникає одразу
              closePicker()
            }}
            // Контекст пікер-попапа — від контролера: flavor вирішує джерело
            // списку (через items/title); пікер не знає нічого про DOCX
            title={activeField.flavor === "cadet" ? "Вибрати курсанта" : "Вибрати співробітника"}
            triggerLabel=""
            icon={<UserRoundSearch className="size-4" />}
            items={
              activeField.flavor === "cadet"
                ? (cadets ?? []).length > 0
                  ? pickerItems
                  : []
                : personnel.length > 0
                  ? pickerItems
                  : []
            }
            selectedId={selectedByInstance[instanceKey(activeField.flavor, activeField.instance)] ?? null}
            onSelect={(personId) => {
              if (activeField.flavor === "cadet") {
                const cadet = (cadets ?? []).find((c) => c.id === personId)
                if (cadet) bindCadet(cadet, String(activeField.instance))
                return
              }
              const person = personnel.find((p) => p.id === personId)
              if (person) void bindPerson(person, String(activeField.instance))
            }}
            onClear={() => unbindPerson(String(activeField.instance), activeField.flavor)}
          />
        </div>
      )}
    </>
  )
}
