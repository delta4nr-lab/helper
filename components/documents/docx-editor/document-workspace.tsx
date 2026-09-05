"use client"

import * as React from "react"
import { CHROME_GROUPS, chromeProbeForSlot } from "@docx-editor.dev/core/editor"
import { DocxEditor, LocaleProvider, useContentControl, useDocxEditor, useHyperlinkPopup } from "@docx-editor.dev/react"
import { Download, Highlighter, Loader2, PanelRight, Save, ScanText, TextCursorInput } from "lucide-react"

import "@docx-editor.dev/core/styles/editor.css"

import { toast } from "sonner"

import { FillPanel } from "@/components/documents/docx-editor/fill-panel"
import {
  ImageInsertDialog,
  insertImageIntoDocument,
  uploadImageFile,
  validateImageFile,
} from "@/components/documents/docx-editor/image-insert-dialog"
import { InsertFieldDialog } from "@/components/documents/docx-editor/insert-field-dialog"
import { bounceSuspend } from "@/components/documents/docx-editor/bounce-suspend"
import type { EditorField, EditorPersonnel } from "@/components/documents/types"
import type { CourseRecordData } from "@/lib/courses/types"
import { uk } from "@/lib/docx-editor/uk"
import { useTheme } from "@/components/theme-provider"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

type WorkspaceProps = {
  templateId: string
  title: string
  fields: EditorField[]
  personnel: EditorPersonnel[]
  /** Джерело DOCX-байтів; за замовчуванням публічний /api/templates/[id]/docx */
  docxUrl?: string
  /** "template": кнопка експорту зберігає шаблон через exportHandler (без завантаження) */
  mode?: "document" | "template"
  /** Серверний action збереження шаблона (FormData: file, title) */
  exportHandler?: (formData: FormData) => Promise<{ ok: boolean; message: string }>
  /** Додаткові елементи у верхньому рядку (наприклад, кнопка полів заповнення) */
  titleActions?: React.ReactNode
  /** Панель праворуч від документа (усередині Root — контекст редактора доступний) */
  sidePanel?: React.ReactNode
  /** Записи активного курсу для автозаповнення курсантських нод */
  courseRecords?: CourseRecordData[]
}

// Один експорт триває водночас (кнопка disabled на pending), тому фіксований id:
// loading-тост замінюється success/error без накопичення повідомлень.
const EXPORT_TOAST_ID = "docx-export"

// Режим «лише заповнення»: каретка мусить жити лише всередині полів (content controls).
// Рушій обмежує тільки Tab-навігацію, тому доповнюємо синхронною підпискою:
// щойно каретка покидає поле (клік поза ним) — одразу повертаємо її в найближче поле,
// до того, як користувач встигне щось надрукувати. На час програмного заповнення
// підпису відскік призупинено (bounceSuspend), щоб не перехоплювати sélection-зміни.
function FormFillToggle() {
  const editor = useDocxEditor()
  const { formFill, toggleFormFill, controls } = useContentControl()

  React.useEffect(() => {
    if (!formFill || !editor) return
    return editor.on("selectionChange", (snapshot) => {
      if (bounceSuspend.active || !editor.surface || !snapshot.editable) return
      const atControl = editor.query({ type: "contentControlAt" })
      if (atControl) return
      editor.surface.contentControls.navigate("next")
    })
  }, [editor, formFill])

  function handleToggle() {
    const turningOn = !formFill
    toggleFormFill()
    if (turningOn && editor?.surface && !editor.query({ type: "contentControlAt" })) {
      editor.surface.contentControls.navigate("next")
    }
  }

  return (
    <Button
      type="button"
      variant={formFill ? "secondary" : "ghost"}
      size="icon-sm"
      onClick={handleToggle}
      disabled={controls.length === 0}
      title="Режим заповнення: редагування лише всередині полів"
      aria-label="Режим заповнення"
    >
      <ScanText className="size-4" />
    </Button>
  )
}

// Підсвітка полів: boundary-хром на всіх контролах — видно, що треба заповнювати.
// Увімкнена за замовчуванням; кнопка перемикає. Стан повторно застосовується при
// кожній версії документа: surface з'являється після завантаження файлу, а
// setShowAll — idempotentний стан хрому (без reflow).
function HighlightToggle({ docVersion }: { docVersion: number }) {
  const editor = useDocxEditor()
  const [on, setOn] = React.useState(true)

  React.useEffect(() => {
    if (!editor?.surface) return
    editor.surface.contentControls.setShowAll(on)
  }, [editor, editor?.surface, on, docVersion])

  return (
    <Button
      type="button"
      variant={on ? "secondary" : "ghost"}
      size="icon-sm"
      onClick={() => setOn((value) => !value)}
      title="Підсвітка полів для заповнення"
      aria-label="Підсвітка полів для заповнення"
    >
      <Highlighter className="size-4" />
    </Button>
  )
}

// Перемикач панелі заповнення: панель завжди змонтована, кнопка лише ховає/показує її.
// За замовчуванням панель скрита — кнопка слугує точкою входу для заповнення полів.
function FillPanelToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <Button
      type="button"
      variant={open ? "secondary" : "ghost"}
      size="icon-sm"
      onClick={onToggle}
      title={open ? "Сховати панель заповнення" : "Показати панель заповнення"}
      aria-label={open ? "Сховати панель заповнення" : "Показати панель заповнення"}
      aria-pressed={open}
    >
      <PanelRight className="size-4" />
    </Button>
  )
}

// Іконка «посилання» з публічного реєстру chrome (Material Symbols path-дані).
const LINK_ICON_PATHS =
  CHROME_GROUPS.find((group) => group.id === "text")?.controls.find((control) => control.id === "link")
    ?.paths ?? null

// Дефолтний рядок «Вставити посилання» у контекстному меню мертвий: Slot виконує
// команду з commandForSlot, а для text.link її в реєстрі немає (тулбар відкриває
// попап, а не команду). Кастомний рядок зі статиком docxRow заміняє дефолтний
// на місці та відкриває той самий попап, що кнопка тулбара й Ctrl+K.
function InsertLinkRow() {
  const editor = useDocxEditor()
  const popup = useHyperlinkPopup()
  const probe = chromeProbeForSlot("text.link")
  const canResult = editor && probe ? editor.can(probe) : null
  const disabledReason =
    canResult && !canResult.ok
      ? (uk.disabledReason[canResult.reason as keyof typeof uk.disabledReason] ?? undefined)
      : undefined
  return (
    <DocxEditor.ContextMenu.Item
      label="Вставити посилання"
      shortcut="Ctrl+K"
      disabled={canResult !== null && !canResult.ok}
      disabledReason={disabledReason}
      icon={
        LINK_ICON_PATHS ? (
          <svg viewBox="0 -960 960 960" width={16} height={16} aria-hidden="true" focusable="false">
            {LINK_ICON_PATHS.map((d, i) => (
              <path key={i} d={d} fill="currentColor" />
            ))}
          </svg>
        ) : undefined
      }
      onSelect={() => popup.openAtCaret()}
    />
  )
}

const InsertLinkMenuRow = Object.assign(InsertLinkRow, { docxRow: "text.link" })

// Іконка «зображення» з публічного реєстру chrome (Material Symbols path-дані).
const IMAGE_ICON_PATHS =
  CHROME_GROUPS.find((group) => group.id === "image")?.controls.find((control) => control.id === "insert")
    ?.paths ?? null

// Закрити відкриту панель меню-бара: синтетичний Escape — панель бібліотеки
// сама обробляє його (закриття + повернення фокуса на тригер).
function closeOpenMenubarMenu() {
  document
    .querySelector(".docx-menubar__menu")
    ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }))
}

// Рядок «Зображення» в меню «Вставити»: пакетний відкриває локальний file picker
// і вбудовує файл безпосередньо. Наш замінює його (статик docxSlot — ключ
// заміни в preset) на діалог із табами «Завантаження» (файл на сервер,
// у бібліотеку користувача) і «Бібліотека» (вибір раніше завантажених).
function InsertImageRow({ onOpen }: { onOpen: () => void }) {
  return (
    <DocxEditor.Menu.Row
      slot="image.insert"
      icon={
        IMAGE_ICON_PATHS ? (
          <svg viewBox="0 -960 960 960" width={16} height={16} aria-hidden="true" focusable="false">
            {IMAGE_ICON_PATHS.map((d, i) => (
              <path key={i} d={d} fill="currentColor" />
            ))}
          </svg>
        ) : undefined
      }
      onSelect={() => {
        closeOpenMenubarMenu()
        onOpen()
      }}
    >
      Зображення
    </DocxEditor.Menu.Row>
  )
}

const InsertImageMenuRow = Object.assign(InsertImageRow, { docxSlot: "image.insert" })

// DnD і Ctrl+V зображень на документ: перехоплюємо capture-фазу до обробників
// пакета — файл спочатку зберігається в бібліотеку користувача (та сама папка
// uploads/users/{userId}, що й у діалозі), потім вбудовується в DOCX тим самим
// пайплайном. Усе, що не файл-зображення (текст, внутрішні перенесення),
// проходить без змін.
const VIEWPORT_DROP_TOAST_ID = "viewport-image-drop"

function findImageFile(source: DataTransfer | null): File | null {
  if (!source) return null
  for (let index = 0; index < source.items.length; index += 1) {
    const item = source.items[index]
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue
    const file = item.getAsFile()
    if (file) return file
  }
  return null
}

function ViewportImageDrop({ className, children }: { className?: string; children: React.ReactNode }) {
  const editor = useDocxEditor()

  async function processImageFile(file: File) {
    if (!editor) return
    const error = validateImageFile(file)
    if (error) {
      toast.error(error)
      return
    }
    toast.loading("Обробка зображення...", { id: VIEWPORT_DROP_TOAST_ID })
    const image = await uploadImageFile(file)
    toast.dismiss(VIEWPORT_DROP_TOAST_ID)
    if (!image) return
    await insertImageIntoDocument(editor, image)
  }

  function handleDropCapture(event: React.DragEvent<HTMLDivElement>) {
    const file = findImageFile(event.dataTransfer)
    if (!file) return
    event.preventDefault()
    event.stopPropagation()
    void processImageFile(file)
  }

  function handlePasteCapture(event: React.ClipboardEvent<HTMLDivElement>) {
    // Змішаний/текстовий paste лишаємо пакету — перехоплюємо лише «чисте» зображення
    if (event.clipboardData.getData("text/plain")) return
    const file = findImageFile(event.clipboardData)
    if (!file) return
    event.preventDefault()
    event.stopPropagation()
    void processImageFile(file)
  }

  return (
    <div
      className={className}
      onDropCapture={handleDropCapture}
      onPasteCapture={handlePasteCapture}
    >
      {children}
    </div>
  )
}

// Експорт/збереження: editor.save() → сервер → тост.
// Режим "template": збереження байтів у Template через exportHandler (без завантаження);
// режим "document" (дефолт): збереження в історію експортів користувача + завантаження.
function ExportButton({
  templateId,
  title,
  saveHandler,
}: {
  templateId: string
  title: string
  saveHandler?: (formData: FormData) => Promise<{ ok: boolean; message: string }>
}) {
  const editor = useDocxEditor()
  const [pending, setPending] = React.useState(false)

  async function handleExport() {
    if (!editor || pending) return
    setPending(true)
    toast.loading(saveHandler ? "Збереження шаблону..." : "Формування DOCX...", { id: EXPORT_TOAST_ID })
    try {
      const buffer = await editor.save()
      const form = new FormData()
      form.set("file", new Blob([buffer], { type: DOCX_MIME }), "document.docx")
      form.set("title", title)

      if (saveHandler) {
        const result = await saveHandler(form)
        toast[result.ok ? "success" : "error"](result.message, { id: EXPORT_TOAST_ID })
        return
      }

      form.set("templateId", templateId)
      const response = await fetch("/api/exports", { method: "POST", body: form })
      const result = (await response.json()) as { message?: string; downloadUrl?: string }
      if (!response.ok) {
        toast.error(result.message ?? "Не вдалося зберегти документ.", { id: EXPORT_TOAST_ID })
        return
      }
      toast.success("DOCX збережено у вашому профілі. Завантаження розпочато.", { id: EXPORT_TOAST_ID })
      if (result.downloadUrl) {
        const link = window.document.createElement("a")
        link.href = result.downloadUrl
        link.download = ""
        link.click()
      }
    } catch {
      toast.error("Не вдалося підключитися до сервера. Спробуйте ще раз.", { id: EXPORT_TOAST_ID })
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={handleExport}
      disabled={pending}
      title={saveHandler ? "Зберегти шаблон" : "Експорт DOCX"}
      aria-label={saveHandler ? "Зберегти шаблон" : "Експорт DOCX"}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : saveHandler ? (
        <Save className="size-4" />
      ) : (
        <Download className="size-4" />
      )}
    </Button>
  )
}

// Робоча область: DocxEditor.Root (контекст) + хром редактора + панель заповнення.
// Тематизація: бібліотека чекає класи docx-editor (світлі токени) і docx-editor.dark
// (темні токени --doc-*) на спільному корені хрому, тому обгортаємо хром обгорткою,
// що слідкує за темою сайту. Папір лишається білим; документ не залишає браузер.
export default function DocumentWorkspace({
  templateId,
  title,
  fields,
  personnel,
  docxUrl,
  mode = "document",
  exportHandler,
  titleActions,
  sidePanel,
  courseRecords,
}: WorkspaceProps) {
  const [bytes, setBytes] = React.useState<Uint8Array | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [docVersion, setDocVersion] = React.useState(0)
  const [fillOpen, setFillOpen] = React.useState(false)
  const [pageSetupOpen, setPageSetupOpen] = React.useState(false)
  const [imageDialogOpen, setImageDialogOpen] = React.useState(false)
  // Діалог вставки кастомного поля заповнення (лише адмінський режим шаблона)
  const [insertFieldOpen, setInsertFieldOpen] = React.useState(false)
  // Назву документа можна змінити/дописати — експорт іде з назвою користувача.
  // Синхронізація з пропом не потрібна: батько монтує компонент із key=templateId,
  // тож при зміні шаблона стан назви ініціалізується заново.
  const [docTitle, setDocTitle] = React.useState(title)
  const { resolvedTheme } = useTheme()

  React.useEffect(() => {
    let cancelled = false
    fetch(docxUrl ?? `/api/templates/${templateId}/docx`)
      .then(async (response) => {
        if (!response.ok) {
          const result = (await response.json().catch(() => null)) as { message?: string } | null
          throw new Error(result?.message ?? "Не вдалося завантажити шаблон.")
        }
        return response.arrayBuffer()
      })
      .then((buffer) => {
        if (!cancelled) setBytes(new Uint8Array(buffer))
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Не вдалося завантажити шаблон.")
      })
    return () => {
      cancelled = true
    }
  }, [templateId, docxUrl])

  if (loadError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {loadError}
      </div>
    )
  }

  if (!bytes) {
    return (
      <div className="flex h-96 items-center justify-center gap-2 rounded-lg border text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Завантаження шаблону...
      </div>
    )
  }

  return (
    <DocxEditor.Root
      document={bytes}
      mode="edit"
      onChange={() => setDocVersion((v) => v + 1)}
    >      {/* Українська локаль для всього chrome редактора (меню, тулбар, діалоги) */}
      <LocaleProvider i18n={uk}>
      <div className={cn("docx-editor flex min-h-0 flex-1 flex-col", resolvedTheme === "dark" && "dark")}>
      <div className="flex flex-wrap items-center gap-2 bg-background/95 px-3 py-2 backdrop-blur">
        <Input
          value={docTitle}
          onChange={(event) => setDocTitle(event.target.value)}
          className="mr-auto h-7 w-72 max-w-full border-transparent bg-transparent px-1.5 font-semibold hover:border-input focus-visible:border-input"
          placeholder="Назва документа"
          aria-label="Назва документа"
        />
        {titleActions}
      </div>

      {/* Меню-бар і тулбар — у дефолтному оформленні бібліотеки.
          Comments/EditingMode приховано: коментарі й правки — Pro, режим змін не використовується.
          Review/Help приховано: рецензування не використовується, «Повідомити про проблему» — ні до чого.
          onPageSetup вмикає пакетний пункт «Параметри сторінки» у меню «Файл» */}
      <DocxEditor.Menu onPageSetup={() => setPageSetupOpen(true)}>
        <DocxEditor.Menu.Review hidden />
        <DocxEditor.Menu.Help hidden />
        {/* Зображення: діалог із табами «Завантаження» (файл на сервер) і
            «Бібліотека» (вибір раніше завантажених), замість пакетного file picker */}
        <DocxEditor.Menu.Insert>
          <InsertImageMenuRow onOpen={() => setImageDialogOpen(true)} />
        </DocxEditor.Menu.Insert>
      </DocxEditor.Menu>

      <DocxEditor.Toolbar>
        <DocxEditor.Toolbar.Comments hidden />
        <DocxEditor.Toolbar.EditingMode hidden />
        {/* Зображення: з панелі заповнення; з тулбара лишається тільки обтікання */}
        <DocxEditor.Toolbar.ImageInsert hidden />
        <DocxEditor.Toolbar.ImageProperties hidden />
        <DocxEditor.Toolbar.ImageAltText hidden />
        {/* Кастомні кнопки: рендеряться останньою групою тулбара */}
        {/* Панель заповнення — лише в режимі документа; у шаблонному режимі її місце займає sidePanel */}
        {mode === "document" && <FillPanelToggle open={fillOpen} onToggle={() => setFillOpen((v) => !v)} />}
        {/* «Додати поле» — адмін вставляє кастомний content control у місце курсора/виділення */}
        {mode === "template" && (
          <DocxEditor.Toolbar.Action
            label="Додати поле"
            icon={<TextCursorInput className="size-4" />}
            onSelect={() => setInsertFieldOpen(true)}
          />
        )}
        <HighlightToggle docVersion={docVersion} />
        <FormFillToggle />
        {/* Експорт іде з назвою, яку дав користувач; порожня назва — фолбек на назву шаблона.
            Режим "template": exportHandler зберігає байти в Template.docxData */}
        <ExportButton
          templateId={templateId}
          title={docTitle.trim() || title}
          saveHandler={mode === "template" ? exportHandler : undefined}
        />
      </DocxEditor.Toolbar>

      {/* Лінійка живе в колонці viewport: рамка лінійки розтягується на ширину
          батька, а відступи центрування бібліотека рахує від ширини viewport.
          Якщо лишити її над рядком viewport+панель, при відкритій панелі
          центри лінійки й сторінки роз'їжджаються на половину ширини панелі. */}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <DocxEditor.HorizontalRuler />
          <ViewportImageDrop className="relative min-h-0 flex-1">
            <DocxEditor.Viewport className="h-full">
              <DocxEditor.VerticalRuler />
              <DocxEditor.HeaderFooterChrome />
              <DocxEditor.NotesChrome />
              <DocxEditor.Content />
              <DocxEditor.HyperLink />
              <DocxEditor.ContextMenu>
                {/* Коментарі не використовуються: прибираємо рядок «Додати коментар».
                    «Вставити посилання»: дефолтний рядок мертвий — замінюємо робочим */}
                <DocxEditor.ContextMenu.Slot slot="review.comments" hidden />
                <InsertLinkMenuRow />
              </DocxEditor.ContextMenu>
              <DocxEditor.ContentControl />
            </DocxEditor.Viewport>
            <DocxEditor.Loading overlay />
          </ViewportImageDrop>
        </div>
        {mode === "document" && (
          <FillPanel open={fillOpen} fields={fields} personnel={personnel} docVersion={docVersion} courseRecords={courseRecords} />
        )}
        {sidePanel}
      </div>
      </div>

      <DocxEditor.PageSetupDialog open={pageSetupOpen} onClose={() => setPageSetupOpen(false)} />
      <ImageInsertDialog open={imageDialogOpen} onOpenChange={setImageDialogOpen} />
      <InsertFieldDialog open={insertFieldOpen} onOpenChange={setInsertFieldOpen} />
      </LocaleProvider>
    </DocxEditor.Root>
  )
}
