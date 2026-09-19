import type { ListQuery } from "@/components/profile/types"

/** Єдиний білдер URL профілю (вкладки, пошук, сортування, пагінація). */
export function buildProfileHref(
  query: Pick<ListQuery, "tab" | "q" | "sort">,
  page?: number
): string {
  const params = new URLSearchParams({ tab: query.tab })
  if (page !== undefined) params.set("page", String(page))
  if (query.q) params.set("q", query.q)
  if (query.sort) params.set("sort", query.sort)
  return `/profile?${params.toString()}`
}
