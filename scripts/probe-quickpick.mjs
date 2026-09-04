// Зонд 15: компактна кнопка по ховеру на ПІБ → список → заповнення
import { chromium } from "playwright"

const BASE = "http://localhost:3000"

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") console.log(`[console.${msg.type()}]`, msg.text().slice(0, 160))
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

  const boundary = page.locator('.docx-content-control-chrome[data-tag="person_1"] .docx-content-control-boundary').first()
  const box = await boundary.boundingBox()
  if (!box) throw new Error("no person boundary")

  // 1. Ховер над ПІБ → кнопка з'явилась?
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(500)
  const wrapperCount = await page.locator("div.fixed").count()
  console.log("hover: quickPick wrapper:", wrapperCount)
  if (!wrapperCount) throw new Error("no quickpick on hover")
  await page.screenshot({ path: "diag-qp-hover.png" })

  // 2. Йдемо курсором на кнопку → вона не зникла → клік → список
  const btn = page.locator("div.fixed button").first()
  const btnBox = await btn.boundingBox()
  if (!btnBox) throw new Error("no trigger")
  await page.mouse.move(btnBox.x + btnBox.width / 2, btnBox.y + btnBox.height / 2)
  await page.waitForTimeout(400)
  console.log("moved to button: wrapper still:", await page.locator("div.fixed").count())
  await btn.click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: "diag-qp-open.png" })

  // 3. Вибір ДАВИДОВИЧА → група заповнюється
  await page.getByRole("button", { name: /ДАВИДОВИЧ/ }).first().click()
  await page.waitForTimeout(3500)
  const state = await page.evaluate(() => {
    const t = [...document.querySelectorAll(".layout-run-text")].map((el) => el.textContent ?? "").join("")
    return {
      name: t.includes("ДАВИДОВИЧ Дмитро"),
      draw: document.querySelectorAll("[data-drawing-node-id]:not(.docx-image-selection-overlay)").length,
      qp: document.querySelectorAll("div.fixed").length,
    }
  })
  console.log("after select:", JSON.stringify(state))
  await page.screenshot({ path: "diag-qp-filled.png" })
  await browser.close()
}

main().catch((e) => {
  console.error("SCRIPT ERROR:", e)
  process.exit(1)
})
