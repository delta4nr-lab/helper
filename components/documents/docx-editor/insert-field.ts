// Спільна вставка кастомного поля (content control) у виділення/каретку.
// Використовується діалогом «Додати поле» і панеллю довідників — одна логіка
// на всі виклики, без дублювання.

import type {
  EditorCommand,
  ExecErrorCode,
  InsertableContentControlType,
} from "@docx-editor.dev/core/contracts/editor"
import type { DocxEditorInstance } from "@docx-editor.dev/core/editor"

import { bounceSuspend } from "./bounce-suspend"

// Зрозумілі користувачу повідомлення для частих відмов insertContentControl
// (решта кодів — фолбек до загального повідомлення).
const EXEC_ERROR_MESSAGES: Partial<Record<ExecErrorCode, string>> = {
  notFound: "Фрагмент не знайдено в документі.",
  ambiguous: "Виділення неоднозначне.",
  locked: "Частина виділення заблокована.",
  unsupported: "Поле має бути в межах одного абзацу.",
}

const GENERIC_ERROR = "Не вдалося вставити поле. Спробуйте ще раз."

export type InsertFieldInput = {
  /** subtype команди insertContentControl. */
  subtype: InsertableContentControlType
  /** Тег контрола (w:tag): ключ, за яким заповнення підставляє значення строго у «своє» поле. */
  tag: string
  /** Людська назва поля (w:alias). */
  title: string
}

export type InsertFieldResult = { ok: true } | { ok: false; message: string }

export type InsertFieldOptions = {
  /** Клік по заготовленому полю довідника: виділений текст ЗАМІНЮЄТЬСЯ
      полем, а не лишається його вмістом — поле завжди показує назву. */
  replaceSelection?: boolean
}

// Вставка поля: одна команда insertContentControl = один undo-крок; порожня
// каретка — порожнє поле з промптом, виділений текст поле обгортає. Для
// заготовлених полів довідників (replaceSelection) обгорнутий текст одразу
// замінюється назвою — виділена область стає полем-заготовкою.
//
// target НЕ передаємо: рушій тоді бере свій живий selection з точними офсетами
// (Uc: target === undefined → Sr(e.state().selection)). Round-trip через
// DocRange втрачав позицію каретки — якір без фрази резолвиться рушієм у span
// усього абзацу, і поле «з'їдало» речення. Тип .d.ts вимагає поле target, тому
// задокументований cast контракту рантайму.
//
// Після вставки внутрішнє виділення рушія — згорнута каретка всередині нового
// контрола, тому повторна вставка стає контролом-сиблінгом поруч, а не
// вкладанням; обгортання буває лише для реально виділеного користувачем тексту.
//
// Усе під bounceSuspend: з увімкненим «Режимом заповнення» bounce інакше
// перехоплює виділення посеред послідовності (патерн fill-panel).
//
// Назва як текст порожнього plainText-поля: рушій не дає задати власний промпт
// в insertContentControl (він зашитий за типом), тому це окремий op через
// setContentControlValue — порожня вставка стає двома undo-кроками. Дата під
// цей шлях не підходить — рушій приймає в date-поле лише значення-ISO, тож там
// промпт лишається штатним, а назва — на alias.
export function insertFieldIntoDocument(
  editor: DocxEditorInstance,
  input: InsertFieldInput,
  options?: InsertFieldOptions
): InsertFieldResult {
  const command = {
    type: "insertContentControl",
    subtype: input.subtype,
    tag: input.tag,
    title: input.title,
  } as unknown as EditorCommand

  bounceSuspend.begin()
  let result
  try {
    result = editor.exec(command)
  } catch {
    bounceSuspend.end()
    return { ok: false, message: GENERIC_ERROR }
  }
  if (!result.ok) {
    bounceSuspend.end()
    return { ok: false, message: EXEC_ERROR_MESSAGES[result.code] ?? GENERIC_ERROR }
  }

  // Назва як текст поля: для порожньої каретки — замість промпта; при
  // replaceSelection (панель довідників) — замість обгорнутого виділеного
  // тексту, тобто виділена область замінюється полем. Новий контрол — той, у
  // якому зараз каретка (детерміновано); query за тегом — лише фолбек.
  if (
    input.subtype === "plainText" &&
    (editor.query({ type: "selectedText" }).trim() === "" || options?.replaceSelection)
  ) {
    const control =
      editor.query({ type: "contentControlAt" }) ??
      editor.query({ type: "contentControls", filter: { tag: input.tag } }).at(-1)
    if (control) {
      // bounceSuspend знімається усередині — після завершення ланцюга запису.
      writeTitleIntoField(editor, control.id, input.title)
      return { ok: true }
    }
  }

  bounceSuspend.end()
  return { ok: true }
}

// Перший коміт може відмовити, поки не завершиться коміт вставки, —
// пауза і ретрай дають стабільний результат (патерн fill-panel).
// bounceSuspend знімається лише коли ланцюг завершено (успіх або вичерпано).
function writeTitleIntoField(editor: DocxEditorInstance, controlId: string, title: string) {
  const surface = editor.surface
  if (!surface) {
    bounceSuspend.end()
    return
  }
  const attempt = (tries: number) => {
    if (surface.contentControls.setValue(controlId, title) || tries <= 0) {
      bounceSuspend.end()
      return
    }
    window.setTimeout(() => attempt(tries - 1), 120)
  }
  attempt(2)
}
