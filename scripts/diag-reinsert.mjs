// Тимчасова перевірка: вставка → видалення картинки → повторна вставка.
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

  const count = () =>
    page.evaluate(() => ({
      drawings: [...document.querySelectorAll("[data-drawing-node-id]")].filter((el) => !el.classList.contains("docx-image-selection-overlay")).length,
      overlays: document.querySelectorAll(".docx-image-selection-overlay").length,
      // «Підпис» шукаємо лише всередині хромів контролів (мітки полів)
      labelVisible: [...document.querySelectorAll(".docx-content-control-chrome")].some((c) =>
        (c.textContent ?? "").replace(/[\u200b\u2060]/g, "").includes("Підпис"),
      ),
      controls: [...document.querySelectorAll(".docx-content-control-chrome[data-tag]")].map((c) => `${c.getAttribute("data-tag")}:${(c.textContent ?? "").replace(/[\u200b\u2060]/g, "").trim().slice(0, 24)}`),
    }))

  await page.goto(`${BASE}/templates/raporty/test`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector("aside", { timeout: 30000 })
  await page.waitForTimeout(5000)

  // Вставка 1
  await page.locator("aside button").first().click()
  await page.getByRole("button", { name: /ДАВИДОВИЧ/ }).first().waitFor({ state: "visible", timeout: 10000 })
  await page.getByRole("button", { name: /ДАВИДОВИЧ/ }).first().click()
  await page.waitForTimeout(3000)
  console.log("after insert 1:", JSON.stringify(await count()))

  // Видаляємо картинку: клік по ній → фокус на оверлей виділення → Delete
  await page.locator("[data-drawing-node-id]").first().click({ force: true })
  await page.waitForTimeout(600)
  console.log("after click:", JSON.stringify(await count()))
  const overlay = page.locator(".docx-image-selection-overlay").first()
  if (await overlay.count()) await overlay.focus()
  await page.keyboard.press("Delete")
  await page.waitForTimeout(1500)
  console.log("after manual delete:", JSON.stringify(await count()))

  // Повторна вставка
  await page.locator("aside button").first().click()
  await page.getByRole("button", { name: /ДАВИДОВИЧ/ }).first().waitFor({ state: "visible", timeout: 10000 })
  await page.getByRole("button", { name: /ДАВИДОВИЧ/ }).first().click()
  await page.waitForTimeout(3000)
  console.log("after insert 2:", JSON.stringify(await count()))

  await page.screenshot({ path: "diag-reinsert.png" })
  await browser.close()
}

main().catch((e) => {
  console.error("SCRIPT ERROR:", e)
  process.exit(1)
})
