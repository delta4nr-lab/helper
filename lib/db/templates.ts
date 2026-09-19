import "server-only"

import { orm } from "@/lib/db"
import {
  getCategory as getFallbackCategory,
  templates as fallbackTemplates,
  type TemplateDefinition,
} from "@/lib/documents/catalog"

export type TemplateSearchItem = TemplateDefinition & {
  categoryTitle: string | null
}

export type TemplateSearchResult = {
  items: TemplateSearchItem[]
  total: number
}

// Пошук по всьому каталогу (усі категорії), не по одній. Індекс будується з
// активних шаблонів + активних категорій, тож нові категорії підхоплюються
// автоматично без змін коду.
export async function searchTemplates(params: {
  q: string
  limit?: number
  offset?: number
}): Promise<TemplateSearchResult> {
  const q = params.q.trim().toLowerCase()
  if (!q) return { items: [], total: 0 }

  const index = await getTemplateIndex()
  const matched = index.filter((item) => matches(item, q))
  const offset = Math.max(0, params.offset ?? 0)
  const limit = params.limit ?? matched.length

  return {
    items: matched.slice(offset, offset + limit),
    total: matched.length,
  }
}

function matches(item: TemplateSearchItem, q: string): boolean {
  const haystack = [
    item.title,
    item.description,
    item.categorySlug,
    item.categoryTitle ?? "",
    ...item.tags,
  ]
    .join(" ")
    .toLowerCase()
  return haystack.includes(q)
}

async function getTemplateIndex(): Promise<TemplateSearchItem[]> {
  try {
    const [templates, categories] = await Promise.all([
      // Без docxData — легкий запит; сортування нижче в пам'яті.
      orm.Template.select(
        "id",
        "categorySlug",
        "title",
        "description",
        "fields",
        "popular",
        "paper",
        "tags",
        "updatedAt"
      )
        .where({ isActive: true })
        .all(),
      orm.Category.select("slug", "title")
        .where({ isActive: true })
        .all(),
    ])

    if (templates.length === 0) return fallbackIndex()

    const titleBySlug = new Map(categories.map((c) => [c.slug, c.title]))
    return templates
      .map((t) => ({
        id: t.id,
        categorySlug: t.categorySlug,
        title: t.title,
        description: t.description,
        fields: t.fields,
        popular: t.popular,
        paper: t.paper === "А4 альбом" ? ("А4 альбом" as const) : ("А4" as const),
        tags: [...t.tags],
        updatedAt: String(t.updatedAt).slice(0, 10),
        categoryTitle: titleBySlug.get(t.categorySlug) ?? null,
      }))
      .sort(
        (a, b) =>
          Number(b.popular) - Number(a.popular) ||
          b.updatedAt.localeCompare(a.updatedAt)
      )
  } catch (error) {
    console.warn("[search] не вдалося отримати індекс шаблонів", error)
    return fallbackIndex()
  }
}

function fallbackIndex(): TemplateSearchItem[] {
  return fallbackTemplates
    .map((t) => ({
      ...t,
      categoryTitle: getFallbackCategory(t.categorySlug)?.title ?? null,
    }))
    .sort(
      (a, b) =>
        Number(b.popular) - Number(a.popular) ||
        b.updatedAt.localeCompare(a.updatedAt)
    )
}
