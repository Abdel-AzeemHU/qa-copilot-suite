import { chromium } from "playwright";

export type Viewport = { width: number; height: number };

export const STANDARD_VIEWPORTS: { name: string; viewport: Viewport }[] = [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "mobile", viewport: { width: 390, height: 844 } },
];

/**
 * Captures a full-page screenshot of the given URL at the specified viewport.
 * Writes the PNG to outputPath (absolute). Headless Chromium, 30s timeout.
 */
export async function captureScreenshot(opts: {
  url: string;
  viewport: Viewport;
  outputPath: string;
}): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: opts.viewport,
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    await page.goto(opts.url, { waitUntil: "networkidle", timeout: 30_000 });
    await page.screenshot({ path: opts.outputPath, fullPage: true });
  } finally {
    await browser.close();
  }
}
