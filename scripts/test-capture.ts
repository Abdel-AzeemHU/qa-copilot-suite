import { captureScreenshot } from "../lib/visual/capture";

captureScreenshot({
  url: "https://example.com",
  viewport: { width: 1440, height: 900 },
  outputPath: "/tmp/visual-test.png",
})
  .then(() => console.log("OK - screenshot captured to /tmp/visual-test.png"))
  .catch((e: Error) => console.error("FAILED:", e.message));
