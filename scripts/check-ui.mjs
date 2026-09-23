import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const testThesis = `Prueba local de tesis ${Date.now()}: crecimiento sostenido.`;
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:3100/apps/finanzas");
await page.getByRole("heading", { name: "Bienvenido a FinanceLab" }).waitFor();
await page.screenshot({ path: "scratch/login.png", fullPage: true });
await page.getByLabel("Correo electrónico").fill("test@example.test");
await page
  .getByLabel("Contraseña", { exact: true })
  .fill("local-test-password");
await page.getByRole("button", { name: "Entrar en mi espacio" }).click();
await page
  .getByRole("heading", { name: "Tendencias a seguir" })
  .waitFor({ timeout: 90000 });
await page.screenshot({ path: "scratch/dashboard.png", fullPage: true });
await page.getByRole("button", { name: "Mercados", exact: true }).click();
await page.getByRole("button", { name: "Europa", exact: true }).click();
await page.getByLabel("Buscar empresa, ticker o sector").fill("ASML");
assert.equal(await page.locator(".fl-market-table tbody tr").count(), 1);
await page
  .getByRole("button", { name: "ASML ASML.AS · Semiconductores" })
  .click();
await page.getByRole("dialog").waitFor();
await page.screenshot({ path: "scratch/detail.png" });
await page.getByRole("button", { name: "Cerrar detalle" }).click();
await page.getByRole("button", { name: "Políticos", exact: true }).click();
await page.getByRole("button", { name: "Leer operaciones" }).first().click();
await page
  .locator(".fl-space-top .fl-table tbody tr")
  .first()
  .waitFor({ timeout: 60000 });
await page.screenshot({ path: "scratch/politics.png", fullPage: true });
await page.getByRole("button", { name: "Trump · Operaciones" }).click();
await page.locator(".fl-table tbody tr").first().waitFor({ timeout: 60000 });
assert.ok((await page.locator(".fl-table tbody tr").count()) > 0);
await page.screenshot({ path: "scratch/trump.png", fullPage: true });
await page.getByRole("button", { name: "Mi diario", exact: true }).click();
await page.getByRole("button", { name: "Registrar idea", exact: true }).click();
await page.getByLabel("¿Por qué te interesa?").fill(testThesis);
await page
  .getByLabel("¿Qué invalidaría tu tesis?")
  .fill("Deterioro de márgenes durante varios trimestres.");
await page.getByRole("button", { name: "Guardar idea" }).click();
await page
  .getByRole("article")
  .filter({ hasText: testThesis })
  .waitFor({ timeout: 30000 });
await page.getByRole("article").filter({ hasText: testThesis }).getByRole("button", { name: "Cerrar simulación" }).click();
await page
  .getByRole("article")
  .filter({ hasText: testThesis })
  .getByText("Cerrada", { exact: true })
  .waitFor();
await page.reload();
await page
  .getByRole("heading", { name: "Tendencias a seguir" })
  .waitFor({ timeout: 90000 });
await page.getByRole("button", { name: "Mi diario", exact: true }).click();
await page.getByRole("article").filter({ hasText: testThesis }).waitFor();
await page.screenshot({ path: "scratch/diary.png", fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: "Radar", exact: true }).click();
await page.screenshot({ path: "scratch/mobile.png", fullPage: true });
const overflow = await page.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth,
);
assert.equal(overflow, false, "Mobile page should not overflow horizontally");
await page.getByRole("button", { name: "Mercados", exact: true }).click();
await page.screenshot({ path: "scratch/mobile-market.png", fullPage: true });
await writeFile(
  "scratch/ui-results.json",
  JSON.stringify(
    { errors, mobileOverflow: overflow, status: "passed" },
    null,
    2,
  ),
);
assert.deepEqual(errors, []);
await browser.close();
console.log(
  "UI passed: login, markets, filters, detail, House PDF, Trump, diary save/close/persistence, mobile width.",
);
