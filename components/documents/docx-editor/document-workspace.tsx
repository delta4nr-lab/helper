"use client"

import * as React from "react"
import {
  CHROME_GROUPS,
  chromeProbeForSlot,
  composeFontConfiguration,
} from "@docx-editor.dev/core/editor"
import {
  DocxEditor,
  LocaleProvider,
  useContentControl,
  useDocxEditor,
  useHyperlinkPopup,
} from "@docx-editor.dev/react"
import { CustomNodeChrome } from "@docx-editor.dev/pro/react"
import { Braces, Download, Loader2, Save } from "lucide-react"

import "@docx-editor.dev/core/styles/editor.css"

import { toast } from "sonner"

import {
  ImageInsertDialog,
  insertImageIntoDocument,
  uploadImageFile,
  validateImageFile,
} from "@/components/documents/docx-editor/image-insert-dialog"
import { FieldEditMenu } from "@/components/documents/docx-editor/field-edit-dialog"
import { FieldInsertDialog } from "@/components/documents/docx-editor/field-insert-dialog"
import { FieldSelect } from "@/components/documents/docx-editor/field-select"
import { KeyboardLayoutShortcuts } from "@/components/documents/docx-editor/keyboard-layout-shortcuts"
import {
  DocumentExportProvider,
  useDocumentExport,
} from "@/components/documents/docx-editor/document-export"
import { PersonnelChrome } from "@/components/documents/docx-editor/personnel-picker"
import {
  TableRowDuplicate,
  RepeatRowAdmin,
} from "@/components/documents/docx-editor/table-row-duplicate"
import {
  canReplayClipboardPaste,
  inlineClipboardCssFont,
} from "@/components/documents/docx-editor/clipboard-html"
import { DocumentRuntimeBridge } from "@/components/documents/docx-editor/runtime/document-runtime-bridge"
import {
  PersonnelPanel,
  type PersonnelEntry,
} from "@/components/documents/docx-editor/personnel-panel"
import type { CourseRecordData } from "@/lib/courses/types"
import { DOCX_MODULES, FieldNode } from "@/lib/docx-editor/field-node"
import { uk } from "@/lib/docx-editor/uk"
import { useTheme } from "@/components/theme-provider"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Дефолтний шрифт/розмір документа (Times New Roman, 28 half-points = 14pt)
// задає сам шаблон через w:docDefaults — рушій його читає (effectiveRunDefaults),
// тож надрукований текст лишається 14pt. Глобальний defaultFont рушія тут НЕ
// задаємо: інакше він накидав 14 на будь-який текст без явного формату, зокрема
// вставлений ззовні (paste має лишатися «як є»). Стабільне посилання ОБОВ'ЯЗКОВЕ:
// новий конфіг щорендеру запускав би перезавантаження шрифтів рушія щоразу —
// «Maximum update depth exceeded».
const EDITOR_FONTS = composeFontConfiguration({ sources: [] })

type WorkspaceProps = {
  templateId: string
  title: string
  /** Джерело DOCX-байтів; за замовчуванням публічний /api/templates/[id]/docx */
  docxUrl?: string
  /** "template": кнопка експорту зберігає шаблон через exportHandler (без завантаження) */
  mode?: "document" | "template"
  /** Серверний action збереження шаблона (FormData: file, title) */
  exportHandler?: (
    formData: FormData
  ) => Promise<{ ok: boolean; message: string }>
  /** Довідник персоналу для персональних полів (template-режим) */
  personnel?: PersonnelEntry[]
  /** Курсанти з активного курсу (template-режим, cadet.{i}.{f}-ноди) */
  cadets?: readonly CourseRecordData[]
}

// Keeper режиму заповнення (formFill): рушій сам обмежує лише Tab-навігацію
// між контролами, тому клік поза полем доповнюємо поверненням каретки в
// найближчий контрол — увесь друк у цьому режимі йде всередину полів.
function FormFillKeeper() {
  const editor = useDocxEditor()
  const { formFill } = useContentControl()

  React.useEffect(() => {
    if (!formFill || !editor) return
    return editor.on("selectionChange", (snapshot) => {
      if (!editor.surface || !snapshot.editable) return
      if (editor.query({ type: "contentControlAt" })) return
      editor.surface.contentControls.navigate("next")
    })
  }, [editor, formFill])

  return null
}

// Іконка «посилання» з публічного реєстру chrome (Material Symbols path-дані).
const LINK_ICON_PATHS =
  CHROME_GROUPS.find((group) => group.id === "text")?.controls.find(
    (control) => control.id === "link"
  )?.paths ?? null

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
      ? (uk.disabledReason[
          canResult.reason as keyof typeof uk.disabledReason
        ] ?? undefined)
      : undefined
  return (
    <DocxEditor.ContextMenu.Item
      label="Вставити посилання"
      shortcut="Ctrl+K"
      disabled={canResult !== null && !canResult.ok}
      disabledReason={disabledReason}
      icon={
        LINK_ICON_PATHS ? (
          <svg
            viewBox="0 -960 960 960"
            width={16}
            height={16}
            aria-hidden="true"
            focusable="false"
          >
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
  CHROME_GROUPS.find((group) => group.id === "image")?.controls.find(
    (control) => control.id === "insert"
  )?.paths ?? null

// Закрити відкриту панель меню-бара: синтетичний Escape — панель бібліотеки
// сама обробляє його (закриття + повернення фокуса на тригер).
function closeOpenMenubarMenu() {
  document
    .querySelector(".docx-menubar__menu")
    ?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    )
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
          <svg
            viewBox="0 -960 960 960"
            width={16}
            height={16}
            aria-hidden="true"
            focusable="false"
          >
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

const InsertImageMenuRow = Object.assign(InsertImageRow, {
  docxSlot: "image.insert",
})

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

function ViewportImageDrop({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  const editor = useDocxEditor()
  // Захист від рекурсії: перевідправлений paste знову пройде через цей capture.
  const replayingPaste = React.useRef(false)

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
    // Word кладе font-size у CSS-клас (`.MsoNormal`), який рушій ігнорує →
    // вставлений текст успадковує docDefaults (14pt). Переносимо класовий
    // шрифт у inline style і перевідправляємо paste зі зміненим clipboardData.
    if (!replayingPaste.current) {
      const html = event.clipboardData.getData("text/html")
      if (html && canReplayClipboardPaste()) {
        const patched = inlineClipboardCssFont(html)
        if (patched !== html) {
          event.preventDefault()
          event.stopPropagation()
          const data = new DataTransfer()
          data.setData("text/plain", event.clipboardData.getData("text/plain"))
          data.setData("text/html", patched)
          const target = (event.target ?? event.currentTarget) as EventTarget
          replayingPaste.current = true
          try {
            target.dispatchEvent(
              new ClipboardEvent("paste", {
                clipboardData: data,
                bubbles: true,
                cancelable: true,
                composed: true,
              })
            )
          } finally {
            replayingPaste.current = false
          }
          return
        }
      }
    }

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

// Кнопка тулбара: викликає спільний експорт (кнопка + меню «Файл → Зберегти»).
function ExportButton({
  saveHandler,
}: {
  saveHandler?: (
    formData: FormData
  ) => Promise<{ ok: boolean; message: string }>
}) {
  const { exportDocument, pending } = useDocumentExport()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={() => void exportDocument()}
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

// Рядок «Файл → Зберегти»: замінює пакетний Save (патерн Object.assign docxSlot,
// як InsertImageMenuRow). Виконує наш експорт замість дефолтного Editor.save().
function SaveDocumentRow() {
  const { exportDocument } = useDocumentExport()
  return (
    <DocxEditor.Menu.Row
      slot="file.save"
      onSelect={() => {
        closeOpenMenubarMenu()
        void exportDocument()
      }}
    >
      Зберегти
    </DocxEditor.Menu.Row>
  )
}

const SaveDocumentMenuRow = Object.assign(SaveDocumentRow, {
  docxSlot: "file.save",
})

// Робоча область: DocxEditor.Root (контекст) + хром редактора.
// Тематизація: бібліотека чекає класи docx-editor (світлі токени) і docx-editor.dark
// (темні токени --doc-*) на спільному корені хрому, тому обгортаємо хром обгорткою,
// що слідкує за темою сайту. Папір лишається білим; документ не залишає браузер.
export default function DocumentWorkspace({
  templateId,
  title,
  docxUrl,
  mode = "document",
  exportHandler,
  personnel,
  cadets,
}: WorkspaceProps) {
  const [bytes, setBytes] = React.useState<Uint8Array | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [pageSetupOpen, setPageSetupOpen] = React.useState(false)
  const [imageDialogOpen, setImageDialogOpen] = React.useState(false)
  // Кастомні поля (custom nodes): діалог вставки в режимі шаблона. Вміст
  // чіпа редагується прямо в документі (нода без payload, lock: false),
  // тому окремої форми заповнення немає.
  const [fieldInsertOpen, setFieldInsertOpen] = React.useState(false)
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
          const result = (await response.json().catch(() => null)) as {
            message?: string
          } | null
          throw new Error(result?.message ?? "Не вдалося завантажити шаблон.")
        }
        return response.arrayBuffer()
      })
      .then((buffer) => {
        if (!cancelled) setBytes(new Uint8Array(buffer))
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setLoadError(
            error instanceof Error
              ? error.message
              : "Не вдалося завантажити шаблон."
          )
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
      fonts={EDITOR_FONTS}
      modules={DOCX_MODULES}
    >
      {/* Українська локаль для всього chrome редактора (меню, тулбар, діалоги) */}
      <LocaleProvider i18n={uk}>
        <DocumentExportProvider
          templateId={templateId}
          title={docTitle.trim() || title}
          saveHandler={mode === "template" ? exportHandler : undefined}
        >
          <FieldSelect />
          <KeyboardLayoutShortcuts />
          <FormFillKeeper />
          {/* Document Runtime v1: індексація/locator (editor — джерело істини,
          dev-only debug через window.__docxRuntimeDebug) */}
          <DocumentRuntimeBridge />
          <div
            className={cn(
              "app-docx docx-editor flex min-h-0 flex-1 flex-col",
              resolvedTheme === "dark" && "dark"
            )}
          >
            <div className="flex flex-wrap items-center gap-2 bg-background/95 px-3 py-2 backdrop-blur">
              <Input
                value={docTitle}
                onChange={(event) => setDocTitle(event.target.value)}
                className="mr-auto h-7 w-72 max-w-full border-transparent bg-transparent px-1.5 font-semibold hover:border-input focus-visible:border-input"
                placeholder="Назва документа"
                aria-label="Назва документа"
              />
            </div>

            {/* Меню-бар і тулбар — у дефолтному оформленні бібліотеки.
          Comments/EditingMode приховано: коментарі й правки — Pro, режим змін не використовується.
          Review/Help приховано: рецензування не використовується, «Повідомити про проблему» — ні до чого.
          onPageSetup вмикає пакетний пункт «Параметри сторінки» у меню «Файл» */}
            <DocxEditor.Menu onPageSetup={() => setPageSetupOpen(true)}>
              {/* Файл → Зберегти: наш експорт замість пакетного Editor.save() */}
              <DocxEditor.Menu.File>
                <SaveDocumentMenuRow />
              </DocxEditor.Menu.File>
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
              {/* Стилі абзацу не використовуються у військових документах */}
              <DocxEditor.Toolbar.StylePicker hidden />
              {/* Зображення вставляються з меню «Вставити»; властивості обраної
                картинки (розмір/обтікання/позиція) — вбудований контрол. Кнопка
                «Властивості зображення» (alt/межа) не працює в цій збірці — hidden */}
              <DocxEditor.Toolbar.ImageInsert hidden />
              <DocxEditor.Toolbar.ImageProperties hidden />
              <DocxEditor.Toolbar.ImageAltText hidden />
              {/* Кастомні поля (custom nodes): вставка в режимі шаблона */}
              {mode === "template" && (
                <DocxEditor.Toolbar.Action
                  label="Додати кастомне поле"
                  icon={<Braces className="size-4" />}
                  onSelect={() => setFieldInsertOpen(true)}
                />
              )}
              {/* Режим заповнення (двигунний): каретка живе лише в полях */}
              <DocxEditor.Toolbar.ContentControlFormFill />
              {/* Експорт іде з назвою, яку дав користувач; порожня назва — фолбек на назву шаблона.
            Режим "template": exportHandler зберігає байти в Template.docxData */}
              <ExportButton
                saveHandler={mode === "template" ? exportHandler : undefined}
              />
            </DocxEditor.Toolbar>

            {/* Лінійка живе в колонці viewport: рамка лінійки розтягується на ширину
          батька, а відступи центрування бібліотека рахує від ширини viewport. */}
            <div className="flex min-h-0 flex-1">
              <div className="flex min-w-0 flex-1 flex-col">
                <DocxEditor.HorizontalRuler />
                <ViewportImageDrop className="relative min-h-0 flex-1">
                  <DocxEditor.Viewport className="h-full">
                    <DocxEditor.VerticalRuler />
                    <DocxEditor.HeaderFooterChrome />
                    <DocxEditor.NotesChrome />
                    <DocxEditor.Content />
                    {/* Чіпи кастомних полів: фарбування (у Viewport після Content —
                  порядок з прикладу документації). У template-режимі з
                  персональними нодами — хром із hover-кнопками прив'язки персоналу */}
                    {/* Хром чіпів + прив'язка: у документ-режимі (заповнення) —
                  PersonnelChrome з hover-кнопкою вибору людини;
                  у template-режимі адмін лише вставляє маркери — прив'язки
                  там немає */}
                    {mode !== "template" &&
                    (personnel?.length || cadets?.length) ? (
                      <PersonnelChrome
                        personnel={personnel ?? []}
                        cadets={cadets ?? []}
                      />
                    ) : (
                      // Приховуємо внутрішні metadata-ноди (RepeatRowMarker/
                      // RepeatRowRegistry) — малюємо чіпи лише для FieldNode.
                      <CustomNodeChrome nodes={[FieldNode]} />
                    )}
                    {/* «» у таблиці = нова людина/курсант (user flow): перехоплює
                  engine-кнопку рядка тільки коли рядок має персональні чіпи */}
                    {mode !== "template" ? (
                      <TableRowDuplicate
                        sourceContext={{
                          personnel: personnel ?? [],
                          cadets: cadets ?? [],
                          referrals: [],
                        }}
                      />
                    ) : null}
                    {/* Admin: mini-кнопка «зробити рядок повторюваним» — лише
                  template-режим; позиціонується біля engine-кнопки «+» */}
                    {mode === "template" ? <RepeatRowAdmin /> : null}
                    <DocxEditor.HyperLink />
                    <DocxEditor.ContextMenu>
                      {/* Коментарі не використовуються: прибираємо рядок «Додати коментар».
                    «Вставити посилання»: дефолтний рядок мертвий — замінюємо робочим.
                    «Edit {label}»: канонічний edit-вхід кастомних ручних полів */}
                      <DocxEditor.ContextMenu.Slot
                        slot="review.comments"
                        hidden
                      />
                      <InsertLinkMenuRow />
                      <FieldEditMenu />
                    </DocxEditor.ContextMenu>
                    {/* Boundary-хром контентів: потрібний для читання офсетів чіпа
                  (каретка після вставки) і показує межі активного контрола */}
                    <DocxEditor.ContentControl />
                  </DocxEditor.Viewport>
                  <DocxEditor.Loading overlay />
                </ViewportImageDrop>
              </div>
              {/* Панель персоналу (template-режим): степер екземпляра + кнопки полів */}
              {/* Панель вставки полів (template-режим): степери + кнопки полів */}
              {mode === "template" ? <PersonnelPanel /> : null}
            </div>

            {/* Діалог усередині .docx-editor: інакше не успадковує --doc-*
            (панель/підкладка стають прозорими) */}
            <DocxEditor.PageSetupDialog
              open={pageSetupOpen}
              onClose={() => setPageSetupOpen(false)}
            />
          </div>

          <ImageInsertDialog
            open={imageDialogOpen}
            onOpenChange={setImageDialogOpen}
          />
          <FieldInsertDialog
            open={fieldInsertOpen}
            onOpenChange={setFieldInsertOpen}
          />
        </DocumentExportProvider>
      </LocaleProvider>
    </DocxEditor.Root>
  )
}
