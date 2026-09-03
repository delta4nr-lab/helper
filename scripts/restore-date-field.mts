// ОДНОРАЗОВЕ відновлення поля «дата» (тег date) шаблона test:
// прибирає випадково вставлене зображення з контрола і повертає текст «дата».
import "dotenv/config"
import JSZip from "jszip"

import { db, orm, nowTimestamp } from "../src/prisma/db"

async function main() {
  const t = await orm.Template.select("docxData").first({ id: "test" })
  if (!t?.docxData) throw new Error("немає docxData")
  const zip = await JSZip.loadAsync(Buffer.from(t.docxData))
  const docFile = zip.file("word/document.xml")!
  let xml = await docFile.async("string")

  const tagIdx = xml.indexOf('<w:tag w:val="date"/>')
  if (tagIdx === -1) throw new Error("контрол date не знайдено")
  const contentStart = xml.indexOf("<w:sdtContent>", tagIdx) + "<w:sdtContent>".length
  const contentEnd = xml.indexOf("</w:sdtContent>", contentStart)
  let content = xml.slice(contentStart, contentEnd)
  console.log("before:", content.slice(0, 300))

  // Прибираємо ран з drawing (якщо є)
  const drawingRun = /<w:r>(?:(?!<w:r>|<\/w:r>)[\s\S])*?<w:drawing[\s\S]*?<\/w:drawing>[\s\S]*?<\/w:r>/
  content = content.replace(drawingRun, "")
  // Повертаємо текст «дата», якщо його немає
  if (!content.includes("дата")) {
    content = content.replace(/^/, '<w:r><w:t xml:space="preserve">дата</w:t></w:r>')
  }

  xml = xml.slice(0, contentStart) + content + xml.slice(contentEnd)
  zip.file("word/document.xml", xml)
  const out = await zip.generateAsync({ type: "uint8array" })
  await orm.Template.where({ id: "test" }).update({ docxData: out, updatedAt: nowTimestamp() })
  console.log("restored, bytes:", out.length)
}
main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => db.close())
