import "server-only"

import JSZip from "jszip"

// Санітизація експортованого DOCX: розгортає всі content controls (w:sdt),
// лишаючи їхній вміст. Два ефекти одним рухом:
// 1) користувач отримує чистий текст без полів заповнення;
// 2) зникають схемно-некоректні структури — SDT з <w:text/> у sdtPr і
//    блоковим вмістом у sdtContent (успадковані з чіпів), через які Word
//    рапортував «непридатний для читання вміст».
//
// Розгортання йде зсередини назовні: регулярка матчить лише SDT без вкладених
// <w:sdt>, тож вкладені (чип staff:person → staff.1.* усередині) коректно
// розгортаються за кілька проходів. Хедери/футери не чіпаються — полів там
// у цьому застосунку немає.

const MAX_UNWRAP_PASSES = 20

// Внутрішній SDT: між <w:sdt> і його закриттям немає ані вкладеного
// <w:sdt>, ані чужого </w:sdt> (інакше регекс перетнув би сусідній контрол)
const INNERMOST_WITH_CONTENT =
  /<w:sdt>(?:(?!<w:sdt>|<\/w:sdt>)[\s\S])*?<w:sdtContent>((?:(?!<\/w:sdtContent>)[\s\S])*)<\/w:sdtContent><\/w:sdt>/g
const INNERMOST_EMPTY =
  /<w:sdt>(?:(?!<w:sdt>|<\/w:sdt>)[\s\S])*?<w:sdtContent\/><\/w:sdt>/g

export async function stripContentControls(
  docx: Uint8Array
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(docx)
  const entry = zip.file("word/document.xml")
  if (!entry) return docx

  let xml = await entry.async("string")
  for (let pass = 0; pass < MAX_UNWRAP_PASSES; pass++) {
    if (!xml.includes("<w:sdt>")) break
    const withContentUnwrapped = xml.replace(INNERMOST_WITH_CONTENT, "$1")
    const next = withContentUnwrapped.replace(INNERMOST_EMPTY, "")
    if (next === xml) break
    xml = next
  }

  if (xml.includes("<w:sdt>")) {
    console.warn("[DocxSanitize] незгорнуті SDT лишились після ліміту проходів")
  }

  zip.file("word/document.xml", xml)
  return zip.generateAsync({ type: "uint8array" })
}
