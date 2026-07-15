import { chromium } from "playwright";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// --- Marketing pages (public) ---
const marketing = [
  { url: "http://localhost:3000/", name: "qaera-home" },
  { url: "http://localhost:3000/features", name: "qaera-features" },
  { url: "http://localhost:3000/pricing", name: "qaera-pricing" },
  { url: "http://localhost:3000/about", name: "qaera-about" },
];
for (const p of marketing) {
  try {
    await page.goto(p.url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(800); // settle animations
    await page.screenshot({ path: `/tmp/screenshots/${p.name}.png`, fullPage: true });
    console.log("OK", p.name);
  } catch (e) {
    console.log("FAIL", p.name, e.message);
  }
}

// --- Tool (login as the seeded demo user) ---
const [email, projectId] = process.argv.slice(2);
await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.fill("#email", email);
await page.fill("#password", "Password123!");
await Promise.all([
  page.waitForURL("**/dashboard", { timeout: 30000 }),
  page.click('form button[type="submit"]'),
]);
console.log("logged in");

const tool = [
  { path: ``, name: "tool-project-overview" },
  { path: `/quality`, name: "tool-quality-dashboard" },
  { path: `/api-tests`, name: "tool-api-tests" },
  { path: `/flakiness`, name: "tool-flakiness" },
  { path: `/execute`, name: "tool-execute" },
  { path: `/pipeline`, name: "tool-pipeline" },
  { path: `/visual`, name: "tool-visual" },
  { path: `/ci`, name: "tool-ci" },
];
for (const p of tool) {
  try {
    await page.goto(`http://localhost:3000/projects/${projectId}${p.path}`, {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.screenshot({ path: `/tmp/screenshots/${p.name}.png`, fullPage: true });
    console.log("OK", p.name);
  } catch (e) {
    console.log("FAIL", p.name, e.message);
  }
}

await browser.close();
