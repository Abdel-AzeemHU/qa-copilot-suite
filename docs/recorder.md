# In-tool Test Recorder

Let a non-technical user create a test by *doing* the actions in a browser.
They click **Record a Test**, a real browser opens, they perform their flow
(click, type, navigate), they click **Stop**, and the tool produces:

1. human-readable test steps,
2. a runnable Playwright script, and
3. an AI-drafted test case (title, description, priority, suggested assertions).

One click then saves it into the existing pipeline (an `AutomationRun` plus a
`TestCase`) so it can be executed from the **Run Tests** page.

## How it works (end to end)

1. **Record** — `POST /api/projects/:id/recorder/start` spawns
   `npx playwright codegen --target=javascript --output=<tmp> <startUrl>`. The
   codegen browser opens on the host running the app.
2. **Stop** — `POST /api/projects/:id/recorder/stop` closes the codegen browser,
   reads the generated script, and parses it into structured `RecordedAction`s
   (`lib/recorder/parse-actions.ts`). It then asks Claude to draft a test case
   (`lib/helpers/recording-summarizer.ts`).
3. **Save** — `POST /api/projects/:id/recorder/save` transforms the codegen
   output into a self-contained ESM script (`lib/recorder/to-runnable.ts`) and
   stores it as an `AutomationRun` (`recorded.spec.mjs`), plus a `TestCase`.
4. **Run** — the existing executor (`worker/executor.ts`) runs the script with
   `node`, injecting `PLAYWRIGHT_TARGET_URL` / `TARGET_URL`.

## Where can it run? (IMPORTANT)

The recorder launches a **real browser on the machine running the app** (the
server host). This means:

- ✅ **Local / self-hosted** (`npm run dev` on your own computer): works out of
  the box — a browser window opens on your desktop.
- ⚠️ **Headless server / cloud** (no graphical display): a headed browser cannot
  open. The recorder detects this and returns a friendly
  `503 RECORDER_UNAVAILABLE` message instead of crashing. To enable it on a
  headless host, run the app under a virtual display, e.g.:

  ```bash
  xvfb-run -a npm run dev
  ```

- 🔜 **Future**: a streaming backend (noVNC / CDP-over-WebSocket) would stream
  the server-side browser to the user's own browser. This is out of scope today.
  All launch/capture logic is isolated in `lib/recorder/` so the backend can be
  swapped without touching the API routes, parser, or UI.

## Notes

- Browser binaries must be installed: `npx playwright install chromium`.
- Password values are masked (`••••`) in the human-readable steps.
