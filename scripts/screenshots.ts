import fs from "fs";
import path from "path";
import { chromium } from "@playwright/test";
import { loadEnvFile } from "../src/lib/env";

loadEnvFile();

const base = process.env.BASE_URL || "http://127.0.0.1:3847";
const email = process.env.ADMIN_EMAIL || "harry@localhost";
const password = process.env.ADMIN_PASSWORD || "growth-engine-local";
const out = path.join(process.cwd(), "docs/screenshots");

const pages = [
  ["01-overview.png", "/"],
  ["02-discover.png", "/discover"],
  ["03-creative.png", "/creative"],
  ["04-live-test.png", "/live"],
  ["06-experiments.png", "/experiments"],
  ["07-affiliates.png", "/affiliates"],
  ["08-memo.png", "/memo"],
  ["09-ads.png", "/ads"],
  ["10-settings.png", "/settings"],
  ["11-support.png", "/support"],
  ["12-tracking.png", "/tracking"],
  ["14-feedback.png", "/feedback"],
  ["15-lifecycle.png", "/lifecycle"],
  ["16-community.png", "/community"],
  ["17-audit.png", "/audit"],
];

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${base}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${base}/`);
  for (const [file, route] of pages) {
    await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(out, file), fullPage: true });
    console.log(file);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(out, "13-overview-mobile.png"), fullPage: true });
  const landing = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await landing.goto(`${base}/try`, { waitUntil: "networkidle" });
  await landing.screenshot({ path: path.join(out, "05-landing.png"), fullPage: true });
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
