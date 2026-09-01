import { Mark, mergeAttributes } from "@tiptap/core"

// Редаговане жовте поле заповнення. На відміну від атомарного FieldExtension
// (адмін-редактор), ця марка НЕ атом — вміст вільно друкується і зберігає
// жовтий стиль (`field-chip`). Використовується у редакторі заповнення документа.
export const FillMark = Mark.create({
  name: "fill",

  inclusive: true,
  excludes: "",

  addAttributes() {
    return {
      fillKey: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-fill-key"),
        renderHTML: (attrs) => (attrs.fillKey ? { "data-fill-key": attrs.fillKey } : {}),
      },
      fillType: {
        default: "text",
        parseHTML: (el) => el.getAttribute("data-fill-type") || "text",
        renderHTML: (attrs) => (attrs.fillType && attrs.fillType !== "text" ? { "data-fill-type": attrs.fillType } : {}),
      },
      fillLabel: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-fill-label"),
        renderHTML: (attrs) => (attrs.fillLabel ? { "data-fill-label": attrs.fillLabel } : {}),
      },
      personId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-person-id"),
        renderHTML: (attrs) => (attrs.personId ? { "data-person-id": attrs.personId } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-fill-key]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "field-chip field-chip--editable" }), 0]
  },
})