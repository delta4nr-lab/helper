export type TemplateCategory = {
  slug: string
  title: string
  description: string
  longDescription: string
  countLabel: string
  icon: "raporty"
}

export type TemplateDefinition = {
  id: string
  title: string
  categorySlug: string
  fields: number
  popular: boolean
  description: string
  tags: string[]
  paper: "А4" | "А4 альбом"
  updatedAt: string
}

// Хаб категорій — зараз тільки рапорти (адмін додасть інші пізніше без коду)
export const categories: TemplateCategory[] = [
  {
    slug: "raporty",
    title: "Рапорти",
    description: "Відпустки, відрядження, заохочення, переміщення",
    longDescription: "Найчастіші документи військовослужбовця. Автозаповнення з картки персоналії, перевірка дат і строків.",
    countLabel: "шаблонів",
    icon: "raporty",
  },
]

export const templates: TemplateDefinition[] = [
  // Єдиний рапорт у фундаменті — відпустка (адмін додасть інші через БД)
  {
    id: "raport-vidpustka",
    title: "Рапорт на відпустку",
    categorySlug: "raporty",
    fields: 6,
    popular: true,
    description: "Щорічна, соціальна, за сімейними обставинами. Розрахунок діб, місце проведення.",
    tags: ["відпустка", "дати", "наказ"],
    paper: "А4",
    updatedAt: "2026-08-29",
  },
]

export function getCategory(slug: string) {
  return categories.find((c) => c.slug === slug)
}

export function getTemplatesByCategory(slug: string) {
  return templates.filter((t) => t.categorySlug === slug)
}

export function getTemplate(categorySlug: string, templateId: string) {
  return templates.find((t) => t.categorySlug === categorySlug && t.id === templateId)
}

export function getCategoryCounts() {
  return categories.map((c) => ({
    ...c,
    count: templates.filter((t) => t.categorySlug === c.slug).length,
  }))
}
