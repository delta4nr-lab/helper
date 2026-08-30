"use client"

import { Node, mergeAttributes } from "@tiptap/core"

// Атом-поле {{field_1}} — не розбивається при редагуванні, зберігає key/label
export const FieldExtension = Node.create({
  name: "field",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      fieldKey: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-field-key"),
        renderHTML: (attrs) => ({ "data-field-key": attrs.fieldKey }),
      },
      label: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-label"),
        renderHTML: (attrs) => ({ "data-label": attrs.label }),
      },
      type: {
        default: "text",
        parseHTML: (el) => el.getAttribute("data-field-type") || "text",
        renderHTML: (attrs) => (attrs.type && attrs.type !== "text" ? { "data-field-type": attrs.type } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-field-key]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const key = node.attrs.fieldKey as string
    const label = (node.attrs.label as string) || key
    const type = (node.attrs.type as string) || "text"
    // Різний колір чіпа залежно від типу поля (підпис / звання / ПІБ / посада)
    const typeClass =
      type === "signature"
        ? " field-chip--signature"
        : type === "rank"
          ? " field-chip--rank"
          : type === "person"
            ? " field-chip--person"
            : type === "position"
              ? " field-chip--position"
              : ""
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-field-key": key,
        "data-label": label,
        "data-field-type": type,
        class: `field-chip${typeClass}`,
        title: `${label} — {{${key}}}`,
        contenteditable: "false",
      }),
      label,
    ]
  },

  // Як відображається в JSON — для збереження в bodyTemplate
  renderText({ node }) {
    const key = node.attrs.fieldKey as string
    return `{{${key}}}`
  },
})
