// Зонд 3: верифікація відновлення назви після видалення + XML збереженого DOCX.
import { chromium } from "playwright"
import JSZip from "jszip"
import { writeFileSync } from "node:fs"

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

  const fill = async () => {
    await page.locator("aside button").first().click()
    await page.getByRole("button", { name: /ДАВИДОВИЧ/ }).first().waitFor({ state: "visible", timeout: 10000 })
    await page.getByRole("button", { name: /ДАВИДОВИЧ/ }).first().click()
    await page.waitForTimeout(2500)
  }

  const modelInfo = () =>
    page.evaluate(
      () => document.querySelectorAll("[data-drawing-node-id]:not(.docx-image-selection-overlay)").length,
    )

  // Вставка 1
  await fill()
  console.log("drawings after fill 1:", await modelInfo())

  // Видалення: клік по картинці → фокус оверлею → Delete
  await page.locator("[data-drawing-node-id]").first().click({ force: true })
  await page.waitForTimeout(600)
  const overlay = page.locator(".docx-image-selection-overlay").first()
  if (await overlay.count()) await overlay.focus()
  await page.keyboard.press("Delete")
  await page.waitForTimeout(1500)

  // Перевірка відновлення назви: у моделі має з'явитись текст «Підпис»
  const restored = await page.evaluate(async () => {
    // Шукаємо видимий текст у фрагментах абзаців (не label-чипи хрому)
    const texts = [...document.querySelectorAll(".layout-run-text")].map((el) => el.textContent ?? "")
    return {
      hasLabelRun: texts.some((t) => t.includes("Підпис")),
      markerLeftover: texts.some((t) => /[\u200b\u2060]/.test(t)),
    }
  })
  console.log("after delete:", JSON.stringify(restored))

  // Повторна вставка
  await fill()
  console.log("drawings after fill 2:", await modelInfo())

  // Експорт → перехоплюємо відповідь /api/exports → завантажуємо файл
  const exportPromise = page
    .waitForResponse((res) => res.url().includes("/api/exports") && res.request().method() === "POST", { timeout: 30000 })
    .then((res) => res.json())
  await page.getByRole("button", { name: /Експорт DOCX/ }).click()
  const exportResult = await exportPromise
  console.log("export downloadUrl:", exportResult.downloadUrl)
  const fileRes = await page.request.get(`${BASE}${exportResult.downloadUrl}`)
  const bytes = await fileRes.body()
  writeFileSync("C:\\Users\\rodri\\AppData\\Local\\Temp\\opencode\\sig-export.docx", bytes)

  // Розбираємо XML: чи drawing всередині SDT з тегом signature_1
  const zip = await JSZip.loadAsync(bytes)
  const xml = await zip.file("word/document.xml").async("string")
  const sdtMatch = xml.match(/<w:sdt>(?:(?!<\/w:sdt>)[\s\S])*?w:val="signature_1"[\s\S]*?<\/w:sdt>/)
  if (sdtMatch) {
    const sdt = sdtMatch[0]
    console.log("SDT signature_1 found, length:", sdt.length)
    console.log("SDT contains w:drawing:", sdt.includes("<w:drawing>"))
    console.log("SDT contains picture tag:", sdt.includes("pic:pic"))
    const inner = sdt.replace(/<[^>]+>/g, "").replace(/[\u200b\u2060]/g, "")
    console.log("SDT visible text:", JSON.stringify(inner.slice(0, 60)))
  } else {
    console.log("SDT signature_1 NOT FOUND — перевір структуру шаблона")
  }
  await browser.close()
}

main().catch((e) => {
  console.error("SCRIPT ERROR:", e)
  process.exit(1)
})
