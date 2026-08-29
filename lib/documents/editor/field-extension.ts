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
    }
  },

  parseHTML() {
    return [{ tag: "span[data-field-key]" }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const key = node.attrs.fieldKey as string
    const label = (node.attrs.label as string) || key
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-field-key": key,
        "data-label": label,
        class: "inline-flex items-center rounded bg-amber-100 px-1 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200",
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
