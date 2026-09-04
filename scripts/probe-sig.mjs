// Верифікація підписа: розміри (wp:extent == a:ext) і позиція в експорті
import { chromium } from "playwright"
import JSZip from "jszip"

const BASE = "http://localhost:3000"

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log(`[console.error]`, msg.text().slice(0, 160))
  })

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

  // Заповнення підписа (група зі штату → ПІБ)
  await page.locator("aside button").first().click()
  await page.getByRole("button", { name: /ДАВИДОВИЧ/ }).first().waitFor({ state: "visible", timeout: 10000 })
  await page.getByRole("button", { name: /ДАВИДОВИЧ/ }).first().click()
  await page.waitForTimeout(3000)

  const exportPromise = page
    .waitForResponse((res) => res.url().includes("/api/exports") && res.request().method() === "POST", { timeout: 30000 })
    .then((res) => res.json())
  await page.getByRole("button", { name: /Експорт DOCX/ }).click()
  const exportResult = await exportPromise
  const fileRes = await page.request.get(`${BASE}${exportResult.downloadUrl}`)
  const bytes = await fileRes.body()

  const zip = await JSZip.loadAsync(bytes)
  const xml = await zip.file("word/document.xml").async("string")
  const anchor = xml.slice(xml.indexOf("<wp:anchor"), xml.indexOf("</wp:anchor>") + 12)
  if (!anchor.includes("<wp:anchor")) {
    console.log("NO anchor in export")
    process.exit(1)
  }
  const wpExtent = anchor.match(/<wp:extent[^>]*>/)?.[0]
  const aExt = anchor.match(/<a:ext[^>]*>/)?.[0]
  const posH = anchor.match(/<wp:positionH[^>]*>[\s\S]*?<\/wp:positionH>/)?.[0]
  const posV = anchor.match(/<wp:positionV[^>]*>[\s\S]*?<\/wp:positionV>/)?.[0]
  console.log("wp:extent:", wpExtent)
  console.log("a:ext:    ", aExt)
  const extMatch = wpExtent?.match(/cx="(\d+)" cy="(\d+)"/)
  const aMatch = aExt?.match(/cx="(\d+)" cy="(\d+)"/)
  console.log("SIZES MATCH:", extMatch?.[1] === aMatch?.[1] && extMatch?.[2] === aMatch?.[2])
  console.log("positionH:", posH)
  console.log("positionV:", posV)
  console.log("behindDoc:", anchor.match(/behindDoc="(\d)"/)?.[1], "(0 = перед текстом)")
  await browser.close()
}

main().catch((e) => {
  console.error("SCRIPT ERROR:", e)
  process.exit(1)
})
