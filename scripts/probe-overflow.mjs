// Зонд 13: overflow-меню тулбара при активній картинці
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

  await page.locator("[data-drawing-node-id]:not(.docx-image-selection-overlay)").first().click({ force: true })
  await page.waitForTimeout(800)

  await page.locator(".docx-toolbar__more").first().click()
  await page.waitForTimeout(600)

  const items = await page.evaluate(() =>
    [...document.querySelectorAll("[role=menuitem], [role=menuitemradio], [role=menuitemcheckbox]")]
      .map((b) => b.textContent?.trim().slice(0, 40))
      .filter(Boolean),
  )
  console.log("menu items:", JSON.stringify(items, null, 1))
  await page.screenshot({ path: "diag-overflow.png" })
  await browser.close()
}

main().catch((e) => {
  console.error("SCRIPT ERROR:", e)
  process.exit(1)
})
