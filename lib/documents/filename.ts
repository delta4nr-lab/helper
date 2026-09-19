// Безпечне ім'я DOCX-файлу з довільного заголовка (без шляхів/службових символів).
export function safeDocxFileName(value: string): string {
  return `${value.replace(/[^\p{L}\p{N}\s-]/gu, "").trim() || "document"}.docx`
}
