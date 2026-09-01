import Paragraph from "@tiptap/extension-paragraph"
import { Table, TableView } from "@tiptap/extension-table"

// Спільні TipTap-розширення для редактора шаблону (адмін) і редактора заповнення документа.

// ── Абзацний відступ ("червоний рядок") 1.25см ≈ 47px ──────────────────────
export const PARAGRAPH_INDENT_PX = 47

export function hasParagraphIndent(editor: { getAttributes: (type: string) => Record<string, unknown> }): boolean {
  try {
    return Boolean(editor.getAttributes("paragraph").textIndent)
  } catch {
    return false
  }
}

// Вмикає/вимикає абзацний відступ (text-indent → "червоний рядок") на поточному абзаці
export function setParagraphIndent(editor: { chain: () => { focus: () => { updateAttributes: (type: string, attrs: Record<string, unknown>) => { run: () => void } } } }, enabled: boolean) {
  editor.chain().focus().updateAttributes("paragraph", { textIndent: enabled ? `${PARAGRAPH_INDENT_PX}px` : null }).run()
}

// Розширення Paragraph: зберігає text-indent окремим атрибутом (як TextAlign зберігає text-align),
// щоб не конфліктувати з вирівнюванням і не перезаписувати style абзацу.
export const ParagraphWithIndent = Paragraph.extend({
  addAttributes() {
    return {
      textIndent: {
        default: null,
        parseHTML: (element) => (element as HTMLElement).style.textIndent || null,
        renderHTML: (attributes) => (attributes.textIndent ? { style: `text-indent: ${attributes.textIndent}` } : {}),
      },
    }
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        // У таблицях/списках Tab керується іншими розширеннями (перехід по комірках, рівні списку)
        if (this.editor.isActive("table")) return false
        if (this.editor.isActive("bulletList") || this.editor.isActive("orderedList")) return false
        setParagraphIndent(this.editor, true)
        return true
      },
      "Shift-Tab": () => {
        if (this.editor.isActive("table")) return false
        if (this.editor.isActive("bulletList") || this.editor.isActive("orderedList")) return false
        setParagraphIndent(this.editor, false)
        return true
      },
    }
  },
})

// ── Таблиця з підтримкою "borderless" (приховані межі) ─────────────────────
class StyledTableView extends TableView {
  constructor(...args: ConstructorParameters<typeof TableView>) {
    super(...args)
    this.syncBorderlessState(this.node)
  }

  update(node: Parameters<TableView["update"]>[0]) {
    const updated = super.update(node)
    if (updated) this.syncBorderlessState(node)
    return updated
  }

  private syncBorderlessState(node: Parameters<TableView["update"]>[0]) {
    const borderless = node.attrs.borderless === true
    this.table.classList.toggle("table-borderless", borderless)
    if (borderless) this.table.setAttribute("data-borderless", "true")
    else this.table.removeAttribute("data-borderless")
  }
}

export const StyledTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      borderless: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-borderless") === "true",
        renderHTML: (attributes) => (attributes.borderless ? { "data-borderless": "true", class: "table-borderless" } : {}),
      },
      style: {
        default: null,
        parseHTML: (element) => element.getAttribute("style"),
        renderHTML: (attributes) => {
          const style = attributes.style as string | null | undefined
          let dataWidth = "auto"
          if (typeof style === "string") {
            const match = style.match(/width:\s*([\d.]+)(px|pt|%)/i)
            if (match) dataWidth = match[2] === "%" ? "percent" : "fixed"
          }
          return { ...(style ? { style } : {}), "data-table-width": dataWidth }
        },
      },
    }
  },
  addOptions() {
    const parent = (this.parent?.() ?? {}) as Record<string, unknown>
    return {
      ...parent,
      resizable: true,
      handleWidth: 5,
      cellMinWidth: 40,
      lastColumnResizable: true,
      allowTableNodeSelection: false,
    } as never
  },
  addNodeView() {
    return ({ node, view, HTMLAttributes }) => new StyledTableView(node, this.options.cellMinWidth, view, HTMLAttributes)
  },
})