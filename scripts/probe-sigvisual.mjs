// Скріншот: підпис у редакторі після paragraph-relative позиції
import { chromium } from "playwright"

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
  await page.waitForTimeout(3000)

  // Прокрутка до таблиці з підписом
  await page.evaluate(() => {
    const drawing = document.querySelector("[data-drawing-node-id]:not(.docx-image-selection-overlay)")
    drawing?.scrollIntoView({ block: "center" })
  })
  await page.waitForTimeout(400)
  await page.screenshot({ path: "diag-sig-para.png" })
  await browser.close()
}

main().catch((e) => {
  console.error("SCRIPT ERROR:", e)
  process.exit(1)
})
