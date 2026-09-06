import "server-only"

import JSZip from "jszip"

// Санітизація експортованого DOCX (користувацький експорт):
// 1) розгортає всі content controls (w:sdt), лишаючи їхній вміст — чистий
//    текст без полів заповнення; заодно зникають схемно-некоректні структури
//    (SDT з <w:text/> у sdtPr і блоковим вмістом у sdtContent — успадковані
//    з чіпів), через які Word рапортував «непридатний для читання вміст»;
// 2) гарантує дефолтний ШРИФТ Times New Roman у docDefaults. Розмір тексту
//    (sz/szCs) НЕ примусовий — наявний зберігається. Ран-рівневе
//    форматування не змінюється.

const MAX_UNWRAP_PASSES = 20

// Внутрішній SDT: між <w:sdt> і його закриттям немає ані вкладеного
// <w:sdt>, ані чужого </w:sdt> (інакше регекс перетнув би сусідній контрол)
const INNERMOST_WITH_CONTENT =
  /<w:sdt>(?:(?!<w:sdt>|<\/w:sdt>)[\s\S])*?<w:sdtContent>((?:(?!<\/w:sdtContent>)[\s\S])*)<\/w:sdtContent><\/w:sdt>/g
const INNERMOST_EMPTY =
  /<w:sdt>(?:(?!<w:sdt>|<\/w:sdt>)[\s\S])*?<w:sdtContent\/><\/w:sdt>/g

const TNR_R_FONTS =
  '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>'

// Дефолтний шрифт у docDefaults/rPrDefault/rPr = Times New Roman. Розміри
// (sz/szCs) та інші властивості rPr зберігаються як є. Відсутні блоки
// створюються (docDefaults → перед першим <w:style> у styles.xml).
function ensureTimesNewRomanDefaults(stylesXml: string): string {
  const rprWithTnr = `<w:rPr>${TNR_R_FONTS}`
  const docDefaultsRe = /<w:docDefaults>([\s\S]*?)<\/w:docDefaults>/
  if (!docDefaultsRe.test(stylesXml)) {
    return stylesXml.replace(
      /(<w:styles[^>]*>)/,
      `$1<w:docDefaults><w:rPrDefault>${rprWithTnr}</w:rPr></w:rPrDefault></w:docDefaults>`
    )
  }
  return stylesXml.replace(docDefaultsRe, (_match, inner: string) => {
    const rprDefaultRe = /<w:rPrDefault>([\s\S]*?)<\/w:rPrDefault>/
    if (!rprDefaultRe.test(inner)) {
      return `<w:docDefaults><w:rPrDefault>${rprWithTnr}</w:rPr></w:rPrDefault></w:docDefaults>${inner}`
    }
    const newInner = inner.replace(rprDefaultRe, (_m, rprDefaultInner: string) => {
      const rPrRe = /<w:rPr>([\s\S]*?)<\/w:rPr>/
      if (!rPrRe.test(rprDefaultInner)) {
        return `<w:rPrDefault>${rprWithTnr}</w:rPr></w:rPrDefault>`
      }
      const newRprInner = rprDefaultInner.includes("<w:rFonts")
        ? rprDefaultInner.replace(/<w:rFonts[^>]*\/>/, TNR_R_FONTS)
        : rprWithTnr
      return `<w:rPrDefault><w:rPr>${newRprInner}</w:rPr></w:rPrDefault>`
    })
    return `<w:docDefaults>${newInner}</w:docDefaults>`
  })
}

export async function sanitizeExportedDocx(
  docx: Uint8Array
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(docx)
  const documentEntry = zip.file("word/document.xml")
  if (!documentEntry) return docx

  let xml = await documentEntry.async("string")
  for (let pass = 0; pass < MAX_UNWRAP_PASSES; pass++) {
    if (!xml.includes("<w:sdt>")) break
    // Replacer-функція: вміст SDT може містити "$…" — рядковий replacement
    // переплутав би його з патернами заміни
    const withContentUnwrapped = xml.replace(
      INNERMOST_WITH_CONTENT,
      (_match, content: string) => content
    )
    const next = withContentUnwrapped.replace(INNERMOST_EMPTY, "")
    if (next === xml) break
    xml = next
  }

  if (xml.includes("<w:sdt>")) {
    console.warn("[DocxSanitize] незгорнуті SDT лишились після ліміту проходів")
  }

  zip.file("word/document.xml", xml)

  const stylesEntry = zip.file("word/styles.xml")
  if (stylesEntry) {
    const stylesXml = await stylesEntry.async("string")
    zip.file("word/styles.xml", ensureTimesNewRomanDefaults(stylesXml))
  }

  return zip.generateAsync({ type: "uint8array" })
}
