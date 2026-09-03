// Зонд 5: XML експорту — плаваючий підпис на рівні документа (поза SDT).
import { chromium } from "playwright"
import JSZip from "jszip"

const BASE = "http://localhost:3000"

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  const csrfRes = await page.request.get(`${BASE}/api/auth/csrf`)
  const { csrfToken } = await csrfRes.json()
  await page.request.post(`${BASE}/api/auth/callback/credentials`, {
    form: { csrfToken, username: "admin", password: "Admin123!", callbackUrl: `${BASE}/` },
    maxRedirects: 0,
    failOnStatusCode: false,
  })

  await page.goto(`${BASE}/templates/raporty/test`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector("aside", { timeout: 30000 })
  await page.waitForTimeout(5000)

  await page.locator("aside button").first().click()
  await page.getByRole("button", { name: /ДАВИДОВИЧ/ }).first().waitFor({ state: "visible", timeout: 10000 })
  await page.getByRole("button", { name: /ДАВИДОВИЧ/ }).first().click()
  await page.waitForTimeout(2500)

  const exportPromise = page
    .waitForResponse((res) => res.url().includes("/api/exports") && res.request().method() === "POST", { timeout: 30000 })
    .then((res) => res.json())
  await page.getByRole("button", { name: /Експорт DOCX/ }).click()
  const exportResult = await exportPromise
  const fileRes = await page.request.get(`${BASE}${exportResult.downloadUrl}`)
  const bytes = await fileRes.body()

  const zip = await JSZip.loadAsync(bytes)
  const xml = await zip.file("word/document.xml").async("string")
  console.log("document.xml has w:drawing:", xml.includes("<w:drawing"))
  console.log("has wp:anchor:", xml.includes("<wp:anchor"))
  const anchor = xml.slice(xml.indexOf("<wp:anchor"), xml.indexOf("</wp:anchor>") + 12)
  console.log("positionH:", anchor.match(/<wp:positionH[^>]*>[\s\S]*?<\/wp:positionH>/)?.[0])
  console.log("positionV:", anchor.match(/<wp:positionV[^>]*>[\s\S]*?<\/wp:positionV>/)?.[0])
  console.log("extent:", anchor.match(/<wp:extent[^>]*>/)?.[0])
  console.log("behindDoc (0 = перед текстом):", anchor.match(/behindDoc="(\d)"/)?.[1])

  // SDT signature_1: тег і назва на місці, тексту «Підпис» нема (сховано)
  const idx = xml.indexOf('w:val="signature_1"')
  const start = xml.lastIndexOf("<w:sdt>", idx)
  const end = xml.indexOf("</w:sdt>", idx) + "</w:sdt>".length
  const sdt = xml.slice(start, end)
  console.log("SDT signature_1 exists:", idx > -1, "| alias:", sdt.includes("Підпис"), "| drawing inside:", sdt.includes("<w:drawing"))
  await browser.close()
}

main().catch((e) => {
  console.error("SCRIPT ERROR:", e)
  process.exit(1)
})
