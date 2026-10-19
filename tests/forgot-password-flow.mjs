// Playwright flow: /forgot-password (WhatsApp + Email) aur /login tabs, light + dark.
// Chalayein: BASE_URL=http://localhost:3311 node tests/forgot-password-flow.mjs
// Live DB nahi chahiye: Supabase na mile tab bhi jawab "agar registered hai" wala hi aana chahiye.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:3311";
const SHOTS = process.env.SHOT_DIR;
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});

for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript((t) => localStorage.setItem("agribridge-theme", t), theme);
  const page = await ctx.newPage();
  const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/built_${name}_${theme}.png`, fullPage: true });

  // ---- forgot password: WhatsApp
  await page.goto(`${BASE}/forgot-password`, { waitUntil: "networkidle", timeout: 180000 });
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains("dark")), theme === "dark");
  await page.getByRole("heading", { name: "Password bhool gaye?" }).waitFor();
  assert.equal(await page.getByRole("tab", { name: /WhatsApp OTP/ }).getAttribute("aria-selected"), "true");
  await shot("forgot_phone");
  await page.getByLabel("Registered mobile number").fill("0300 1234567");
  await page.getByRole("button", { name: "WhatsApp par code bhejein" }).click();
  await page.getByText(/^Agar ye number registered hai to WhatsApp par 6 hindse code/).waitFor({ timeout: 60000 });
  await page.getByText(/0300 \*\*\*4567 par aaya 6 hindse code/).waitFor();
  assert.equal(await page.locator('[aria-current="step"]').innerText(), "2 · OTP");
  await page.locator("#otp").fill("123456");
  await shot("forgot_otp");
  await page.getByRole("button", { name: "Code tasdeeq karein" }).click();
  await page.getByRole("alert").waitFor({ timeout: 60000 });

  // ---- forgot password: Email (enumeration-safe)
  await page.goto(`${BASE}/forgot-password`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /Email link/ }).click();
  await shot("forgot_email");
  await page.getByLabel("Email").fill("aurangzaibranapk@gmail.com");
  await page.getByRole("button", { name: "Reset link bhejein" }).click();
  await page.getByText(/^Agar ye email registered hai to reset link bhej diya gaya hai/).waitFor({ timeout: 60000 });

  // ---- login: tabs + step hints
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.getByRole("tab", { name: "Login" }).waitFor();
  await page.getByText(/OTP se login/).first().waitFor();
  await page.getByText(/Naya user\?/).waitFor();
  await shot("login_tab");
  await page.getByRole("tab", { name: "Naya account (OTP)" }).click();
  assert.equal(await page.locator('[aria-current="step"]').innerText(), "1 · Mobile number");
  await page.getByText("2 · WhatsApp OTP").waitFor();
  await page.getByText("3 · Naam / password").waitFor();
  await page.getByText(/Is number par 6 hindse ka WhatsApp code aayega/).waitFor();
  await shot("login_signup");
  await ctx.close();
  console.log(`PASS: forgot-password + login flow (${theme})`);
}
await browser.close();
