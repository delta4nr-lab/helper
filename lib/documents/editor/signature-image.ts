import { Node, mergeAttributes } from "@tiptap/core"

// Inline-зображення підпису в редакторі заповнення документа.
// Вставляється всередину fill-марки поля «Підпис», коли обрано особу зі штату.
// Рендериться як zero-width слот (не впливає на розміщення тексту/таблиць),
// а саме зображення позиціонується поверх слота через CSS (.signature-img).
export const SignatureImageNode = Node.create({
  name: "signatureImage",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (el) => el.querySelector("img")?.getAttribute("src") ?? null,
        renderHTML: (attrs) => (attrs.src ? { src: attrs.src } : {}),
      },
      fillKey: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-fill-key"),
        renderHTML: (attrs) => (attrs.fillKey ? { "data-fill-key": attrs.fillKey } : {}),
      },
      personId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-person-id"),
        renderHTML: (attrs) => (attrs.personId ? { "data-person-id": attrs.personId } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-signature]" }]
  },

  renderHTML({ HTMLAttributes }) {
    const { src, ...rest } = HTMLAttributes
    return [
      "span",
      mergeAttributes({ class: "signature-slot", "data-signature": "true" }, rest),
      ["img", { src: src ?? "", class: "signature-img", alt: "підпис" }],
    ]
  },
})