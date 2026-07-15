"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";

interface ApiCase {
  id: string;
  title: string;
  type: string;
  priority: string;
  method: string | null;
  path: string | null;
  lastRun: {
    id: string;
    status: string;
    responseCode: number | null;
    completedAt: string | null;
  } | null;
}

interface AssertionResult {
  description: string;
  passed: boolean;
  detail: string;
}

interface ApiTestRun {
  id: string;
  testCaseId: string;
  status: string;
  method: string | null;
  url: string | null;
  responseCode: number | null;
  responseTimeMs: number | null;
  responseBody: string | null;
  assertions: string; // JSON
  errorMessage: string | null;
  testCase: { id: string; title: string; type: string } | null;
}

function methodVariant(method: string | null): BadgeProps["variant"] {
  switch ((method ?? "").toUpperCase()) {
    case "GET":
      return "info";
    case "POST":
      return "low";
    case "PUT":
    case "PATCH":
      return "medium";
    case "DELETE":
      return "high";
    default:
      return "secondary";
  }
}

function statusVariant(status: string): BadgeProps["variant"] {
  if (status === "passed") return "low";
  if (status === "failed" || status === "error") return "high";
  if (status === "running" || status === "queued") return "medium";
  return "secondary";
}

const TERMINAL = new Set(["passed", "failed", "error"]);

export function ApiTestRunnerPanel({ projectId }: { projectId: string }) {
  const [cases, setCases] = useState<ApiCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<Record<string, ApiTestRun>>({});
  const [activeRunIds, setActiveRunIds] = useState<string[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadCases = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/api-tests/cases`);
    if (res.ok) {
      const data = (await res.json()) as { cases: ApiCase[] };
      setCases(data.cases);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === cases.length) setSelected(new Set());
    else setSelected(new Set(cases.map((c) => c.id)));
  };

  const pollRuns = useCallback(
    async (ids: string[]) => {
      const res = await fetch(
        `/api/projects/${projectId}/api-tests/runs?ids=${ids.join(",")}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { runs: ApiTestRun[] };
      setRuns((prev) => {
        const next = { ...prev };
        for (const r of data.runs) next[r.testCaseId] = r;
        return next;
      });
      const allDone = data.runs.every((r) => TERMINAL.has(r.status));
      if (allDone && data.runs.length >= ids.length) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        void loadCases();
      }
    },
    [projectId, loadCases],
  );

  const handleRun = async () => {
    if (selected.size === 0) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/api-tests/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testCaseIds: Array.from(selected) }),
      });
      const data = (await res.json()) as { runIds?: string[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to start run");
        return;
      }
      const ids = data.runIds ?? [];
      setActiveRunIds(ids);
      if (pollRef.current) clearInterval(pollRef.current);
      await pollRuns(ids);
      pollRef.current = setInterval(() => pollRuns(ids), 2000);
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return <p className="py-8 text-center text-neutral-500">Loading…</p>;
  }

  if (cases.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-200 py-12 text-center">
        <p className="font-medium text-neutral-700">No API test cases yet</p>
        <p className="mt-1 text-sm text-neutral-500">
          Import a spec and generate test cases first, then run them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-neutral-50 p-3">
        <button className="text-xs text-blue-600 hover:underline" onClick={toggleAll}>
          {selected.size === cases.length ? "Deselect all" : "Select all"}
        </button>
        <Button size="sm" onClick={handleRun} disabled={running || selected.size === 0}>
          {running ? "Starting…" : `Run selected (${selected.size})`}
        </Button>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</p>
      )}

      <div className="space-y-2">
        {cases.map((c) => {
          const run = runs[c.id];
          const status = run?.status ?? c.lastRun?.status ?? "not_run";
          const assertions: AssertionResult[] = run?.assertions
            ? (JSON.parse(run.assertions) as AssertionResult[])
            : [];
          return (
            <Card key={c.id}>
              <CardContent className="space-y-2 pt-4">
                <div className="flex flex-wrap items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={selected.has(c.id)}
                    onChange={() => toggle(c.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={methodVariant(c.method)}>{c.method}</Badge>
                      <span className="truncate font-mono text-xs">{c.path}</span>
                      <Badge variant="secondary">{c.type}</Badge>
                    </div>
                    <p className="mt-1 text-sm font-medium">{c.title}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {status !== "not_run" ? (
                      <Badge variant={statusVariant(status)}>{status}</Badge>
                    ) : (
                      <span className="text-xs text-neutral-400">not run</span>
                    )}
                    {run?.responseCode != null && (
                      <span className="text-xs text-neutral-400">
                        HTTP {run.responseCode}
                        {run.responseTimeMs != null ? ` · ${run.responseTimeMs}ms` : ""}
                      </span>
                    )}
                  </div>
                </div>

                {run?.errorMessage && (
                  <p className="ml-7 text-sm text-red-600">{run.errorMessage}</p>
                )}

                {assertions.length > 0 && (
                  <ul className="ml-7 space-y-0.5">
                    {assertions.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <span className={a.passed ? "text-green-600" : "text-red-600"}>
                          {a.passed ? "✓" : "✗"}
                        </span>
                        <span className="text-neutral-600">
                          {a.description}
                          <span className="text-neutral-400"> — {a.detail}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
