import { chromium } from "playwright";

const BASE = "http://localhost:3000";

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

// Login
await page.goto(`${BASE}/login`);
await page.fill('input[name="email"], input[type="email"]', "abdelazeemhu@gmail.com");
await page.fill('input[name="password"], input[type="password"]', "password123");
await Promise.all([
  page.waitForURL("**/dashboard", { timeout: 15000 }).catch(() => {}),
  page.click('button[type="submit"]'),
]);
await page.waitForTimeout(1500);
console.log("after login url:", page.url());

// Go to dashboard, click Team
await page.goto(`${BASE}/dashboard`);
await page.waitForTimeout(500);
const teamLink = page.locator('a:has-text("Team")');
await teamLink.first().click();
await page.waitForTimeout(1500);
console.log("members page url:", page.url());

// Invite a member
await page.fill('#invite-email', "newteammate@example.com");
await page.selectOption('#invite-role', "member");
await page.click('button:has-text("Send invite")');
await page.waitForTimeout(1500);

const bodyText = await page.locator("body").innerText();
console.log("has invite link section:", bodyText.includes("Share this link"));
console.log("has pending email:", bodyText.includes("newteammate@example.com"));

await page.screenshot({ path: "/tmp/members-page.png", fullPage: true });
console.log("screenshot saved");

// Extract the invite token to verify the preview page
const code = await page.locator("code").first().innerText().catch(() => "");
console.log("invite link:", code);

if (code.includes("/invitations/")) {
  const token = code.split("/invitations/")[1].trim();
  // Visit preview page (still logged in as inviter; email mismatch path expected)
  await page.goto(`${BASE}/invitations/${token}`);
  await page.waitForTimeout(1000);
  const inviteBody = await page.locator("body").innerText();
  console.log("invite preview shows org name:", inviteBody.includes("Team invitation"));
  console.log("invite preview shows role:", inviteBody.toLowerCase().includes("member"));
  await page.screenshot({ path: "/tmp/invite-preview.png", fullPage: true });
  console.log("preview screenshot saved");
}

await browser.close();
