// Тимчасова діагностика підпису (видаляється після).
import { chromium } from "playwright"

const BASE = "http://localhost:3000"

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  page.on("pageerror", (err) => console.log("[pageerror]", String(err).slice(0, 300)))
  page.on("console", (msg) => {
    if (msg.type() === "warning" || msg.type() === "error") console.log(`[console.${msg.type()}]`, msg.text().slice(0, 300))
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

  await page.locator("aside button").first().click()
  await page.getByRole("button", { name: /ДАВИДОВИЧ/ }).first().waitFor({ state: "visible", timeout: 10000 })
  await page.getByRole("button", { name: /ДАВИДОВИЧ/ }).first().click()
  await page.waitForTimeout(4000)

  const status = await page.locator("aside p.text-xs").allTextContents()
  console.log("panel status:", JSON.stringify(status))
  const state = await page.evaluate(() => {
    const drawing = document.querySelector("[data-drawing-node-id]")
    const d = drawing?.getBoundingClientRect()
    const page3 = drawing?.closest("[class*='docx-page'], [class*='docx-editor-page']")
    const p = page3?.getBoundingClientRect()
    const inTable = drawing?.closest("table") != null
    const text = [...document.querySelectorAll(".docx-pages")].map((x) => x.textContent ?? "").join(" ")
    return {
      drawings: document.querySelectorAll("[data-drawing-node-id]").length,
      drawingParent: drawing?.parentElement?.className?.slice(0, 60) ?? null,
      inTable,
      offsetInPage: d && p ? { left: Math.round(d.left - p.left), top: Math.round(d.top - p.top) } : null,
      pibFilled: text.includes("ДАВИДОВИЧ Дмитро"),
      labelVisible: text.includes("Підпис"),
    }
  })
  console.log("state:", JSON.stringify(state, null, 2))

  await page.screenshot({ path: "diag-sig2.png" })
  await browser.close()
}

main().catch((e) => {
  console.error("SCRIPT ERROR:", e)
  process.exit(1)
})
