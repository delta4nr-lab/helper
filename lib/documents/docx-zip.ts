import "server-only"

import JSZip from "jszip"

// Захист від ZIP-bomb: DOCX — це ZIP, і стиснений файл може розпакуватися в
// гігабайти (OOM/DoS). JSZip.loadAsync читає лише центральний каталог, тож
// розміри записів відомі ДО розпакування — перевіряємо їх і кидаємо помилку.
//
// Ліміти з запасом: звичайний DOCX має document.xml до ~10 МБ, styles ~1 МБ,
// сумарно до ~50 МБ. 64 МБ/файл і 200 МБ сумарно нічого легітимного не ріжуть.
const MAX_ENTRIES = 2000
const MAX_ENTRY_UNCOMPRESSED = 64 * 1024 * 1024
const MAX_TOTAL_UNCOMPRESSED = 200 * 1024 * 1024

export class DocxTooLargeError extends Error {
  constructor(message = "DOCX перевищує ліміт розпакування") {
    super(message)
    this.name = "DocxTooLargeError"
  }
}

// JSZip зберігає центральний каталог у внутрішньому `_data` кожного запису;
// поле uncompressedSize доступне до виклику async() (версія піни 3.10.x).
type ZipEntryInternal = { _data?: { uncompressedSize?: number } }

/** Розпаковує DOCX із перевіркою сумарного розміру розпакування. */
export async function loadDocxZip(bytes: Uint8Array): Promise<JSZip> {
  const zip = await JSZip.loadAsync(bytes)

  let total = 0
  let entries = 0
  for (const file of Object.values(zip.files)) {
    if (file.dir) continue
    entries += 1
    const size =
      (file as unknown as ZipEntryInternal)._data?.uncompressedSize ?? 0
    total += size
    if (
      entries > MAX_ENTRIES ||
      size > MAX_ENTRY_UNCOMPRESSED ||
      total > MAX_TOTAL_UNCOMPRESSED
    ) {
      throw new DocxTooLargeError()
    }
  }

  return zip
}
