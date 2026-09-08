export const PAPERS = ["А4", "А4 альбом"] as const
export type TemplatePaper = (typeof PAPERS)[number]
