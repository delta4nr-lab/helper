// Повторювані рядки таблиці — два Custom Node + БД як джерело даних.
//
//   1. RepeatRowMarker — ТОНКИЙ marker у таблиці (без payload/dataBinding).
//      Identity у w:tag: `r=<repeatId>` та `e=<entityId>` (id DB-запису, який
//      показує рядок). Без schema навмисно: content-control із w:dataBinding
//      робить table-команди недоступними (can(insertRow) → "bound").
//
//   2. RepeatRowRegistry — payload-нода ПОЗА таблицями (service-абзац у кінці
//      body). Тримає мапу repeatId → RepeatRowDefinition (метадані групи).
//
// STRUCTURE рядка береться з LIVE template row (найверхніший рядок групи):
// копіюємо весь вміст його комірок через insertFragment, змінюючи лише
// FieldNode (новий instance + плейсхолдер, unbound) і переносячи RepeatRowMarker.

import { z } from "zod"
import { defineCustomNode } from "@docx-editor.dev/pro"

// ── Definition (лише метадані групи) ────────────────────────────────────────

const repeatDataSourceSchema = z.enum(["personnel", "course", "medicalReferral"])

export const repeatRowSchema = z.object({
  repeatId: z.string().min(1).max(64),
  flavor: z.enum(["staff", "cadet"]),
  markerCellIndex: z.number().int().min(0),
  dataSource: repeatDataSourceSchema,
})

export type RepeatRowDefinition = z.infer<typeof repeatRowSchema>
export type RepeatDataSource = z.infer<typeof repeatDataSourceSchema>

// ── 1. Thin marker (у таблиці) ─────────────────────────────────────────────

export const REPEAT_ROW_TAG_PREFIX = "repeat"

type RepeatMarkerAttrs = {
  /** repeatId */
  r: string
  /** entityId DB-запису (відсутній для legacy-рядків) */
  e?: string
}

// Тонкий marker: identity у w:tag, БЕЗ schema/payload → не блокує insertRow.
export const RepeatRowMarker = defineCustomNode({
  name: "row",
  tagPrefix: REPEAT_ROW_TAG_PREFIX,
  fromDocx: ({ attrs }): RepeatMarkerAttrs | null => {
    const r = attrs["r"]
    if (!r) return null
    const e = attrs["e"]
    return e ? { r, e } : { r }
  },
  preserveOnExport: true,
})

// ── 2. Registry (поза таблицями) ───────────────────────────────────────────

export const repeatRegistrySchema = z.object({
  definitions: z.record(z.string(), repeatRowSchema),
})

export const RepeatRowRegistry = defineCustomNode({
  name: "registry",
  tagPrefix: REPEAT_ROW_TAG_PREFIX,
  schema: repeatRegistrySchema,
  // text обов'язковий і непорожній (рушій забороняє "").
  text: () => " ",
  fromDocx: ({ attrs }) => {
    const kind = attrs["registry"]
    if (!kind) return null
    return { registry: kind }
  },
  preserveOnExport: true,
})

export const REPEAT_REGISTRY_ATTR = "registry"
export const REPEAT_REGISTRY_VALUE = "1"

// ── repeatId ───────────────────────────────────────────────────────────────

const REPEAT_ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789"

/**
 * Короткий випадковий repeatId (10 символів). Адмін не вводить вручну.
 * Значення коротке, бо живе у w:tag поряд з `e=<entityId>`.
 */
export function generateRepeatId(): string {
  const bytes = new Uint8Array(10)
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  let out = ""
  for (const byte of bytes) out += REPEAT_ID_ALPHABET[byte % REPEAT_ID_ALPHABET.length]
  return out
}
