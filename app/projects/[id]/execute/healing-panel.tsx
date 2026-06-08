"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";

interface VerificationRun {
  id: string;
  status: string;
  result: string | null;
}

interface HealingAttempt {
  id: string;
  attemptNumber: number;
  classification: string;
  diagnosis: string;
  patchedCode: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  verificationRun: VerificationRun | null;
}

const MAX_ATTEMPTS = 3;
const TERMINAL_ATTEMPT = new Set([
  "healed",
  "failed_again",
  "needs_review",
  "error",
]);

function classificationVariant(classification: string): BadgeProps["variant"] {
  if (classification === "repairable") return "info";
  if (classification === "likely_bug") return "medium";
  return "secondary";
}

function classificationLabel(classification: string): string {
  if (classification === "repairable") return "Repairable";
  if (classification === "likely_bug") return "Likely a real bug";
  return "Inconclusive";
}

function attemptStatusVariant(status: string): BadgeProps["variant"] {
  if (status === "healed") return "low";
  if (status === "failed_again" || status === "error") return "high";
  if (status === "needs_review") return "medium";
  return "secondary";
}

export function HealingPanel({ runId }: { runId: string }) {
  const [attempts, setAttempts] = useState<HealingAttempt[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bugReportState, setBugReportState] = useState<
    Record<string, "idle" | "creating" | "created" | "error">
  >({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  useEffect(() => stopPolling, []);

  const fetchAttempts = async () => {
    try {
      const res = await fetch(`/api/runs/${runId}/heal`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as HealingAttempt[];
      setAttempts(data);
      setLoaded(true);
      const latest = data[data.length - 1];
      if (!latest || TERMINAL_ATTEMPT.has(latest.status)) {
        stopPolling();
      }
    } catch {
      // transient
    }
  };

  useEffect(() => {
    void fetchAttempts();
    return stopPolling;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const handleHeal = async () => {
    setError(null);
    setStarting(true);
    stopPolling();
    try {
      const res = await fetch(`/api/runs/${runId}/heal`, { method: "POST" });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setError(data.error ?? "Failed to start self-heal");
        return;
      }
      await fetchAttempts();
      pollRef.current = setInterval(() => void fetchAttempts(), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start self-heal");
    } finally {
      setStarting(false);
    }
  };

  const handleCreateBugReport = async (attemptId: string) => {
    setBugReportState((prev) => ({ ...prev, [attemptId]: "creating" }));
    try {
      const res = await fetch("/api/bug-reports/from-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });
      if (!res.ok) {
        setBugReportState((prev) => ({ ...prev, [attemptId]: "error" }));
        return;
      }
      setBugReportState((prev) => ({ ...prev, [attemptId]: "created" }));
    } catch {
      setBugReportState((prev) => ({ ...prev, [attemptId]: "error" }));
    }
  };

  const atCap = attempts.length >= MAX_ATTEMPTS;
  const inProgress =
    attempts.length > 0 &&
    !TERMINAL_ATTEMPT.has(attempts[attempts.length - 1].status);

  return (
    <div className="space-y-4 rounded-md border border-neutral-200 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Self-healing</h3>
          <p className="text-xs text-neutral-500">
            Ask the AI to diagnose this failure, and — if it looks like an
            automation issue rather than a real bug — automatically patch and
            re-verify the script.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            type="button"
            variant="outline"
            onClick={handleHeal}
            disabled={starting || inProgress || atCap}
          >
            {starting || inProgress ? "Healing…" : "Self-heal"}
          </Button>
          {atCap ? (
            <span className="text-xs text-neutral-500">
              Maximum of {MAX_ATTEMPTS} self-heal attempts reached for this run.
            </span>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loaded && attempts.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No self-heal attempts yet for this run.
        </p>
      ) : null}

      <div className="space-y-3">
        {attempts.map((a) => (
          <div
            key={a.id}
            className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-neutral-500">
                Attempt #{a.attemptNumber}
              </span>
              <Badge variant={classificationVariant(a.classification)}>
                {classificationLabel(a.classification)}
              </Badge>
              <Badge variant={attemptStatusVariant(a.status)}>{a.status}</Badge>
            </div>

            {a.diagnosis ? (
              <p className="text-sm text-neutral-700">{a.diagnosis}</p>
            ) : (
              <p className="text-sm text-neutral-500">Analyzing…</p>
            )}

            {a.errorMessage ? (
              <p className="text-sm text-red-600">{a.errorMessage}</p>
            ) : null}

            {a.status === "healed" ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-green-700">
                  ✅ Healed — the patched script passed verification.
                </p>
                {a.verificationRun ? (
                  <p className="text-xs text-neutral-500">
                    Verification run:{" "}
                    <span className="font-mono">
                      {a.verificationRun.id.slice(0, 8)}
                    </span>{" "}
                    — <Badge variant="low">{a.verificationRun.status}</Badge>
                  </p>
                ) : null}
                {a.patchedCode ? (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-neutral-600">
                      View patched code
                    </summary>
                    <pre className="mt-1.5 max-h-64 overflow-auto rounded-md border border-neutral-200 bg-white p-3 text-xs">
                      {a.patchedCode}
                    </pre>
                  </details>
                ) : null}
              </div>
            ) : null}

            {a.status === "failed_again" ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-amber-700">
                  ⚠️ The patch did not resolve the failure on re-run.
                </p>
                {a.verificationRun ? (
                  <p className="text-xs text-neutral-500">
                    Verification run:{" "}
                    <span className="font-mono">
                      {a.verificationRun.id.slice(0, 8)}
                    </span>{" "}
                    — <Badge variant="high">{a.verificationRun.status}</Badge>
                  </p>
                ) : null}
                {a.patchedCode ? (
                  <details className="text-xs" open>
                    <summary className="cursor-pointer text-neutral-600">
                      Patched code (for review)
                    </summary>
                    <pre className="mt-1.5 max-h-64 overflow-auto rounded-md border border-neutral-200 bg-white p-3 text-xs">
                      {a.patchedCode}
                    </pre>
                  </details>
                ) : null}
              </div>
            ) : null}

            {a.status === "needs_review" ? (
              <div className="space-y-2">
                <p className="text-sm text-neutral-700">
                  {a.classification === "likely_bug"
                    ? "This looks like a real product bug rather than an automation issue — a patch was not attempted."
                    : "The diagnosis was inconclusive — a human should review this run."}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={
                    bugReportState[a.id] === "creating" ||
                    bugReportState[a.id] === "created"
                  }
                  onClick={() => void handleCreateBugReport(a.id)}
                >
                  {bugReportState[a.id] === "created"
                    ? "Bug report created ✓"
                    : bugReportState[a.id] === "creating"
                      ? "Creating…"
                      : "Create bug report from this run"}
                </Button>
                {bugReportState[a.id] === "error" ? (
                  <p className="text-sm text-red-600">
                    Failed to create bug report.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
