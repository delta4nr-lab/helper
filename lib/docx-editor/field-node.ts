// Визначення Custom Node — @docx-editor.dev/pro, конфігурація «Nodes
// without a payload»: schema немає — рушій не прив'язує чіп до customXml,
// тож вміст чіпа РЕДАГОВУЄТЬСЯ прямо в документі (друк у чіпі працює для
// всіх нод; «a payload-bearing node is uneditable whatever this says» —
// саме тому payload не використовуємо).
//
// Identity в тезі — мінімальна і стабільна:
//   key = staff.{index}.{field} (getStaffTag) для персональних полів,
//         або довільний ключ ручного поля (≤ 48 символів — валідація через
//         encodeCustomNodeTag при вставці/редагуванні);
//   p   = personnelId, дописується в тег прив'язкою людини (updateCustomNode
//         з attrs { key, p }) — сумарний тег ≤ 64 (nanoid 21 → 58, перевірено).
// fieldType/personInstance ВИВОДЯТЬСЯ зі схеми key у fromDocx — не
// кодуються в тезі додатково.
// fromDocx читає attrs тега при відкритті (Word зберігає тег) і повертає
// null для контролів без key — вони лишаються звичайними content controls.
//
// preserveOnExport: 'text' — зовнішня копія лишає слова чіпа без службової
// розмітки (документований патерн для merge-полів).

import { customNodesModule, defineCustomNode, reviewModule } from "@docx-editor.dev/pro"

export const FIELD_TAG_PREFIX = "acme"

// Attrs чіпа після fromDocx (маютьську contract типу для читання в
// picker'ах/формах; personInstance/personnelId — рядки, бо приходять
// з тега).
export type FieldChipAttrs = {
  key: string
  fieldType?: string
  personInstance?: string
  personnelId?: string
}

export const FieldNode = defineCustomNode({
  name: "field",
  tagPrefix: FIELD_TAG_PREFIX,
  fromDocx: ({ attrs }): FieldChipAttrs | null => {
    const key = attrs["key"]
    if (!key) return null
    // Схема staff.{i}.{f} — fieldType/personInstance виводяться з key;
    // p — personnelId, доданий прив'язкою людини (updateCustomNode).
    const m = /^staff\.([1-9][0-9]*)\.([a-zA-Z][a-zA-Z0-9_]*)$/.exec(key)
    return {
      key,
      fieldType: m ? m[2] : (attrs["f"] ?? undefined),
      personInstance: m ? m[1] : (attrs["i"] ?? undefined),
      personnelId: attrs["p"] ?? undefined,
    }
  },
  preserveOnExport: "text",
})

// Модулі читаються ОДИН раз при конструюванні редактора («modules are read
// when the editor is constructed»), тому масив будується поза рендером.
// onDiagnostic — документований listener валідації payload'ів; reviewModule
// — джерело editor.getReviewItems(): тільки з ним ноди мають рушійні
// range-позиції (documentaція «Review items — requires the review
// module»), якими placeCaretBesideField ставить каретку за нодою.
export const DOCX_MODULES = [
  customNodesModule({
    nodes: [FieldNode],
    onDiagnostic: ({ code, name, nodeId, issues }) => {
      console.warn("[field-node]", `${name} ${nodeId}: ${code}`, issues)
    },
  }),
  reviewModule(),
]
