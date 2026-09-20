// Реєстр іконок категорій: ключ зберігається в Category.icon, компонент
// CategoryIcon малює відповідну іконку. Клієнт-безпечно (server component
// картки каталогу теж імпортує CategoryIcon).

import {
  BookOpen,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  GraduationCap,
  Shield,
  Stethoscope,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react"

export type CategoryIconEntry = {
  key: string
  label: string
  icon: LucideIcon
}

export const CATEGORY_ICONS: readonly CategoryIconEntry[] = [
  { key: "folder", label: "Папка", icon: FolderOpen },
  { key: "reports", label: "Рапорти", icon: FileText },
  { key: "spreadsheet", label: "Таблиці", icon: FileSpreadsheet },
  { key: "orders", label: "Накази", icon: ClipboardList },
  { key: "personnel", label: "Особовий склад", icon: Users },
  { key: "security", label: "Безпека", icon: Shield },
  { key: "medical", label: "Медицина", icon: Stethoscope },
  { key: "training", label: "Навчання", icon: GraduationCap },
  { key: "transport", label: "Транспорт", icon: Truck },
  { key: "reference", label: "Довідники", icon: BookOpen },
] as const

export type CategoryIconKey = (typeof CATEGORY_ICONS)[number]["key"]

export const CATEGORY_ICON_KEYS = CATEGORY_ICONS.map((entry) => entry.key) as [
  CategoryIconKey,
  ...CategoryIconKey[],
]

const BY_KEY = new Map<string, CategoryIconEntry>(
  CATEGORY_ICONS.map((entry) => [entry.key, entry])
)

// Старі/легасі значення, які ще можуть лежати в БД (seed, перші категорії).
const LEGACY_ALIASES: Record<string, CategoryIconKey> = {
  raporty: "reports",
}

/** Нормалізує значення з БД у валідний ключ реєстру або null (невідоме). */
export function normalizeCategoryIcon(
  value: string | null | undefined
): CategoryIconKey | null {
  if (!value) return null
  if (BY_KEY.has(value)) return value as CategoryIconKey
  return LEGACY_ALIASES[value] ?? null
}

/**
 * Стабільний компонент іконки (без динамічного створення компонентів у рендері):
 * невідоме/порожнє значення → FolderOpen.
 */
export function CategoryIcon({
  value,
  className,
}: {
  value: string | null | undefined
  className?: string
}) {
  switch (normalizeCategoryIcon(value)) {
    case "reports":
      return <FileText className={className} />
    case "spreadsheet":
      return <FileSpreadsheet className={className} />
    case "orders":
      return <ClipboardList className={className} />
    case "personnel":
      return <Users className={className} />
    case "security":
      return <Shield className={className} />
    case "medical":
      return <Stethoscope className={className} />
    case "training":
      return <GraduationCap className={className} />
    case "transport":
      return <Truck className={className} />
    case "reference":
      return <BookOpen className={className} />
    default:
      return <FolderOpen className={className} />
  }
}
