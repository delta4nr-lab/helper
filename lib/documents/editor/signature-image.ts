import { Node, mergeAttributes } from "@tiptap/core"

// Inline-зображення підпису в редакторі заповнення документа.
// Вставляється всередину fill-марки поля «Підпис», коли обрано особу зі штату.
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
        parseHTML: (el) => el.getAttribute("src"),
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
    return [{ tag: "img[data-signature]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes, { "data-signature": "true", class: "signature-editor-img", alt: "підпис" })]
  },
})