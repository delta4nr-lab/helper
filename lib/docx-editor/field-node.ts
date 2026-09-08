// Визначення кастомного поля (merge field) — строго за документацією
// @docx-editor.dev/pro, конфігурація «Nodes without a payload»:
// schema немає — увесь зміст (key) живе в w:tag (Word лімітує його 64
// символами, валідація вставки — encodeCustomNodeTag), а вміст чіпа є
// звичайним редагованим текстом. Саме тому поле правиться прямо в
// документі: «A node carrying a payload is uneditable whatever this says»
// — а в нас payload немає, і вставка виконується з lock: false.
//
// fromDocx читає key із тега при відкритті (Word зберігає тег) і повертає
// null для контролів без key — вони лишаються звичайними content controls.
//
// preserveOnExport: 'text' — зовнішня копія лишає слова чіпа без службової
// розмітки (документований патерн для merge-полів).

import { customNodesModule, defineCustomNode } from "@docx-editor.dev/pro"

export const FIELD_TAG_PREFIX = "acme"

export const FieldNode = defineCustomNode({
  name: "field",
  tagPrefix: FIELD_TAG_PREFIX,
  fromDocx: ({ attrs }) => (attrs["key"] ? { key: attrs["key"] } : null),
  preserveOnExport: "text",
})

// Модулі читаються ОДИН раз при конструюванні редактора («modules are read
// when the editor is constructed»), тому масив будується поза рендером.
export const DOCX_MODULES = [customNodesModule({ nodes: [FieldNode] })]
