// Visual verification: screenshot key flows at desktop + mobile widths.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const stamp = Date.now();
const EMAIL = `shots-${stamp}@test.dev`;
const PASS = "Shots12345";

mkdirSync("shots", { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto(`${BASE}/`);
await page.waitForTimeout(800);
await page.screenshot({ path: "shots/01-landing.png", fullPage: true });

await page.goto(`${BASE}/register`);
await page.getByLabel("Name").fill("Screenshot Driver");
await page.getByLabel("Email").fill(EMAIL);
await page.getByLabel("Password").fill(PASS);
await page.getByRole("button", { name: "Create account" }).click();
await page.waitForURL(/onboarding/, { timeout: 15000 });
await page.screenshot({ path: "shots/02-onboarding.png" });

// finish onboarding (defaults; no demo data)
for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Continue" }).click();
await page.getByRole("button", { name: "Finish setup" }).click();
await page.waitForURL(/dashboard/, { timeout: 60000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: "shots/03-dashboard.png", fullPage: true });

for (const [name, path] of [
  ["04-earnings", "/earnings"],
  ["05-analytics", "/analytics"],
  ["06-platforms", "/platforms"],
  ["07-offers", "/offers"],
  ["08-rules", "/rules"],
  ["09-schedule", "/schedule"],
  ["10-settings", "/settings/profile"],
]) {
  await page.goto(`${BASE}${path}`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `shots/${name}.png`, fullPage: name !== "03-dashboard" });
}

// mobile pass
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/dashboard`);
await page.waitForTimeout(900);
await page.screenshot({ path: "shots/11-mobile-dashboard.png", fullPage: true });
await page.goto(`${BASE}/`);
await page.waitForTimeout(600);
await page.screenshot({ path: "shots/12-mobile-landing.png" });

await browser.close();
console.log("done");
