// Препроцесинг HTML буфера обміну перед рушієм.
//
// Рушій читає font-size/шрифт лише з inline `style` елементів (див. `Je`/`sd`
// у @docx-editor.dev/core). Word натомість кладе розмір у CSS-клас
// (`.MsoNormal { font-size:12.0pt }`), який рушій ігнорує → вставлений текст
// успадковує `w:docDefaults` документа (14pt). Тут ми переносимо класові
// font-size/font-family у inline `style`, щоб вставка лишалась «як є».
//
// Тільки браузерне середовище (DOMParser/ClipboardEvent); на сервері не викликається.

const FONT_PROP_NAMES = new Set(["font-size", "font-family"])

/** Клас → декларації шрифту з усіх `<style>` документа. */
function collectClassFontRules(doc: Document): Map<string, Map<string, string>> {
  const rules = new Map<string, Map<string, string>>()
  for (const styleEl of Array.from(doc.querySelectorAll("style"))) {
    // Word обгортає частину правил у <!-- --> сумісності
    const css = (styleEl.textContent ?? "").replace(/<!--|-->/g, "")
    if (!css) continue
    const blockRe = /([^{}]+)\{([^{}]*)\}/g
    let block: RegExpExecArray | null
    while ((block = blockRe.exec(css)) !== null) {
      const declarations = parseFontDeclarations(block[2])
      if (declarations.size === 0) continue
      for (const selector of block[1].split(",")) {
        const classRe = /\.(-?[_a-zA-Z][\w-]*)/g
        let match: RegExpExecArray | null
        while ((match = classRe.exec(selector)) !== null) {
          const existing = rules.get(match[1]) ?? new Map<string, string>()
          for (const [name, value] of declarations) existing.set(name, value)
          rules.set(match[1], existing)
        }
      }
    }
  }
  return rules
}

function parseFontDeclarations(raw: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const part of raw.split(";")) {
    const separator = part.indexOf(":")
    if (separator <= 0) continue
    const name = part.slice(0, separator).trim().toLowerCase()
    const value = part.slice(separator + 1).trim()
    if (value && FONT_PROP_NAMES.has(name)) out.set(name, value)
  }
  return out
}

function parseInlineStyle(raw: string | null): Map<string, string> {
  const out = new Map<string, string>()
  if (!raw) return out
  for (const part of raw.split(";")) {
    const separator = part.indexOf(":")
    if (separator <= 0) continue
    const name = part.slice(0, separator).trim().toLowerCase()
    const value = part.slice(separator + 1).trim()
    if (name) out.set(name, value)
  }
  return out
}

/**
 * Повертає HTML із перенесеними у inline `style` класовими
 * `font-size`/`font-family`. Якщо змін немає (немає `<style>`-класів зі
 * шрифтом або всі inline-властивості вже задані) — повертає вхідний рядок.
 */
export function inlineClipboardCssFont(html: string): string {
  if (!html || typeof DOMParser === "undefined") return html
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(html, "text/html")
  } catch {
    return html
  }
  const classRules = collectClassFontRules(doc)
  if (classRules.size === 0) return html

  let changed = false
  for (const el of Array.from(doc.querySelectorAll<HTMLElement>("[class]"))) {
    const classList = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean)
    if (classList.length === 0) continue
    const inline = parseInlineStyle(el.getAttribute("style"))
    const additions: string[] = []
    for (const className of classList) {
      const font = classRules.get(className)
      if (!font) continue
      for (const [name, value] of font) {
        if (inline.has(name)) continue
        inline.set(name, value)
        additions.push(`${name}:${value}`)
      }
    }
    if (additions.length === 0) continue
    const current = el.getAttribute("style") ?? ""
    const prefix = current && !current.trimEnd().endsWith(";") ? `${current};` : current
    el.setAttribute("style", `${prefix}${additions.join(";")}`)
    changed = true
  }

  return changed ? `<!DOCTYPE html>${doc.documentElement.outerHTML}` : html
}

/** Чи браузер дозволяє відтворити `paste` зі зміненим `clipboardData`. */
export function canReplayClipboardPaste(): boolean {
  if (typeof ClipboardEvent === "undefined" || typeof DataTransfer === "undefined") return false
  try {
    const data = new DataTransfer()
    data.setData("text/plain", "x")
    return new ClipboardEvent("paste", { clipboardData: data }).clipboardData !== null
  } catch {
    return false
  }
}
