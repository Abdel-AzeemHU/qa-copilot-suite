"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";

interface ContractRunSummary {
  id: string;
  status: string;
  totalEndpoints: number;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  includeUnsafe: boolean;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

interface ContractResult {
  id: string;
  method: string;
  path: string;
  status: string; // passed | failed | skipped | error
  responseCode: number | null;
  durationMs: number | null;
  issues: string; // JSON string[]
  detail: string | null;
}

function statusVariant(status: string): BadgeProps["variant"] {
  if (status === "passed") return "low";
  if (status === "failed" || status === "error") return "high";
  if (status === "skipped") return "secondary";
  return "medium";
}

const TERMINAL = new Set(["passed", "failed", "error"]);

export function ContractPanel({
  projectId,
  specId,
}: {
  projectId: string;
  specId: string;
}) {
  const [runs, setRuns] = useState<ContractRunSummary[]>([]);
  const [results, setResults] = useState<ContractResult[]>([]);
  const [starting, setStarting] = useState(false);
  const [includeUnsafe, setIncludeUnsafe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(
      `/api/projects/${projectId}/api-specs/${specId}/contract`,
    );
    if (!res.ok) return;
    const data = (await res.json()) as {
      runs: ContractRunSummary[];
      latestResults: ContractResult[];
    };
    setRuns(data.runs);
    setResults(data.latestResults);
    const latest = data.runs[0];
    if (latest && TERMINAL.has(latest.status) && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, [projectId, specId]);

  useEffect(() => {
    void load();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/api-specs/${specId}/contract`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ includeUnsafe }),
        },
      );
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to start contract check");
        return;
      }
      await load();
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => void load(), 2500);
    } finally {
      setStarting(false);
    }
  };

  const latest = runs[0];

  return (
    <div className="space-y-3 rounded-md border border-neutral-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Contract check</p>
          <p className="text-xs text-neutral-500">
            Probes the live API and verifies responses against the spec —
            catches spec-vs-code drift.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-neutral-600">
            <input
              type="checkbox"
              checked={includeUnsafe}
              onChange={(e) => setIncludeUnsafe(e.target.checked)}
            />
            include non-GET (may mutate data)
          </label>
          <Button size="sm" onClick={handleStart} disabled={starting}>
            {starting ? "Starting…" : "Run contract check"}
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-2 text-sm text-red-600">{error}</p>
      )}

      {latest && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
          <Badge variant={statusVariant(latest.status)}>{latest.status}</Badge>
          <span>
            {latest.passedCount} passed · {latest.failedCount} failed ·{" "}
            {latest.skippedCount} skipped
            {latest.totalEndpoints ? ` / ${latest.totalEndpoints} endpoints` : ""}
          </span>
          <span className="text-neutral-400">
            {new Date(latest.createdAt).toLocaleString()}
          </span>
          {latest.errorMessage && (
            <span className="text-red-600">{latest.errorMessage}</span>
          )}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-1">
          {results.map((r) => {
            const issues = (JSON.parse(r.issues) as string[]) ?? [];
            return (
              <div
                key={r.id}
                className="rounded border border-neutral-100 p-2 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                  <span className="font-mono">
                    {r.method} {r.path}
                  </span>
                  {r.responseCode != null && (
                    <span className="text-neutral-400">
                      HTTP {r.responseCode}
                      {r.durationMs != null ? ` · ${r.durationMs}ms` : ""}
                    </span>
                  )}
                </div>
                {r.detail && (
                  <p className="mt-1 text-neutral-500">{r.detail}</p>
                )}
                {issues.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-red-600">
                    {issues.map((iss, i) => (
                      <li key={i}>• {iss}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
