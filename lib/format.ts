// Форматування значень для UI (server-side, щоб уникнути розбіжностей гідратації).

const BYTE_UNITS = ["Б", "КБ", "МБ", "ГБ"] as const

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 Б"
  const index = Math.min(
    BYTE_UNITS.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  )
  const value = bytes / 1024 ** index
  const rounded = index === 0 || value >= 10 ? Math.round(value) : value.toFixed(1)
  return `${rounded} ${BYTE_UNITS[index]}`
}

export function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}
