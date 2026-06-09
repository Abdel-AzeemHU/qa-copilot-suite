/**
 * Shared types for the in-tool test recorder.
 *
 * ARCHITECTURE NOTE (read carefully):
 * The recorder launches a REAL browser via Playwright's `codegen` engine on the
 * SERVER — i.e. the machine running `npm run dev`. This is ideal for LOCAL /
 * self-hosted use (the user's own machine), which is the primary use case today.
 *
 * For a future cloud deployment the browser would need to be streamed to the
 * user's own browser (noVNC / CDP-over-WebSocket). That is intentionally OUT OF
 * SCOPE here. All "launch + capture" logic is isolated in this `lib/recorder/`
 * module so the backend can later be swapped for a streaming implementation
 * without touching the API routes, parser, or UI.
 */

export type RecordedActionType =
  | "navigate"
  | "click"
  | "fill"
  | "select"
  | "check"
  | "press"
  | "assert"
  | "other";

export interface RecordedAction {
  type: RecordedActionType;
  /** Human description, e.g. "Submit button", "Email field". */
  target: string;
  /** For fill/select/press — the value entered (masked for passwords). */
  value?: string;
  /** The raw Playwright locator/expression. */
  selector: string;
  /** Friendly sentence, e.g. "Click the 'Submit' button". */
  humanText: string;
}

export interface RecordedResult {
  rawCode: string;
  actions: RecordedAction[];
}

/** Structured error surfaced when a browser cannot be launched. */
export interface RecorderUnavailable {
  error: "RECORDER_UNAVAILABLE";
  message: string;
}

export interface RecordingSession {
  sessionId: string;
  startUrl: string;
}

export function isRecorderUnavailable(
  v: unknown,
): v is RecorderUnavailable {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as { error?: string }).error === "RECORDER_UNAVAILABLE"
  );
}
