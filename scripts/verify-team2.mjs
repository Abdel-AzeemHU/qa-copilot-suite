import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();

await page.goto(`${BASE}/login`);
await page.fill('input[type="email"]', "abdelazeemhu@gmail.com");
await page.fill('input[type="password"]', "password123");
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard", { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1000);

await page.click('a:has-text("Team")');
await page.waitForURL("**/members", { timeout: 10000 });
await page.waitForTimeout(800);

await page.fill('#invite-email', "newteammate@example.com");
await page.click('button:has-text("Send invite")');
await page.waitForSelector('text=Share this link', { timeout: 8000 });
await page.waitForTimeout(800);

const body = await page.locator("body").innerText();
console.log("pending shows email:", body.includes("newteammate@example.com"));
console.log("copy invite link button:", body.includes("Copy invite link"));
console.log("share-this-link panel:", body.includes("Share this link"));

await page.screenshot({ path: "/tmp/members-with-invite.png", fullPage: true });
console.log("screenshot saved");
await browser.close();
