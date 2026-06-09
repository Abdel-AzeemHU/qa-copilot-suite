"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// --- Types ---

interface FlakinessReport {
  id: string;
  testCaseId: string | null;
  targetUrl: string;
  totalRuns: number;
  passCount: number;
  failCount: number;
  errorCount: number;
  status: string;
  flakinessScore: number;
  quarantined: boolean;
  rootCause: string | null;
  suggestions: string | null;
  triggeredAt: string;
  completedAt: string | null;
  testCase: { id: string; title: string } | null;
}

// --- Helpers ---

function statusVariant(status: string): BadgeProps["variant"] {
  if (status === "stable") return "low";
  if (status === "flaky") return "medium";
  if (status === "broken") return "high";
  return "secondary";
}

function scoreLabel(score: number, status: string): string {
  if (status === "running") return "running…";
  return `${(score * 100).toFixed(0)}% failure rate`;
}

function parseSuggestions(raw: string | null): string[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [raw];
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

// --- Sub-components ---

function RunProgress({
  report,
  runCount,
}: {
  report: FlakinessReport;
  runCount: number;
}) {
  if (report.status !== "running") return null;
  const pct = Math.round((report.totalRuns / runCount) * 100);
  return (
    <div className="mt-2">
      <div className="mb-1 flex justify-between text-xs text-neutral-500">
        <span>
          Run {report.totalRuns}/{runCount}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ReportCard({
  report,
  projectId,
  runCount,
  onQuarantineToggle,
}: {
  report: FlakinessReport;
  projectId: string;
  runCount: number;
  onQuarantineToggle: (id: string, val: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const suggestions = parseSuggestions(report.suggestions);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="truncate font-medium text-sm">
              {report.testCase?.title ?? report.targetUrl}
            </p>
            {report.testCase && (
              <p className="mt-0.5 truncate text-xs text-neutral-500">
                {report.targetUrl}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {report.quarantined && (
              <Badge variant="secondary">quarantined</Badge>
            )}
            <Badge variant={statusVariant(report.status)}>
              {report.status}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        <RunProgress report={report} runCount={runCount} />

        {report.status !== "running" && (
          <>
            {/* Score bar */}
            <div>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-neutral-500">
                  {scoreLabel(report.flakinessScore, report.status)}
                </span>
                <span className="text-neutral-400">
                  {report.passCount} pass · {report.failCount} fail ·{" "}
                  {report.errorCount} error
                </span>
              </div>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full bg-green-500"
                  style={{
                    width: `${(report.passCount / report.totalRuns) * 100}%`,
                  }}
                />
                <div
                  className="h-full bg-red-500"
                  style={{
                    width: `${(report.failCount / report.totalRuns) * 100}%`,
                  }}
                />
                <div
                  className="h-full bg-orange-400"
                  style={{
                    width: `${(report.errorCount / report.totalRuns) * 100}%`,
                  }}
                />
              </div>
              <div className="mt-0.5 flex gap-3 text-xs text-neutral-400">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-green-500" />
                  pass
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-red-500" />
                  fail
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-orange-400" />
                  error
                </span>
              </div>
            </div>

            {/* AI analysis */}
            {report.rootCause && (
              <div className="rounded-md bg-neutral-50 p-3 text-sm">
                <p className="mb-1 font-medium text-neutral-700">Root Cause</p>
                <p className="text-neutral-600">{report.rootCause}</p>
                {suggestions.length > 0 && (
                  <div className="mt-2">
                    <button
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => setExpanded((v) => !v)}
                    >
                      {expanded ? "Hide suggestions" : `Show ${suggestions.length} suggestion${suggestions.length !== 1 ? "s" : ""}`}
                    </button>
                    {expanded && (
                      <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-neutral-600">
                        {suggestions.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <span className="text-xs text-neutral-400">
                {formatDate(report.triggeredAt)}
              </span>
              {(report.status === "flaky" || report.status === "broken") && (
                <Button
                  size="sm"
                  variant={report.quarantined ? "outline" : "ghost"}
                  onClick={() =>
                    onQuarantineToggle(report.id, !report.quarantined)
                  }
                >
                  {report.quarantined ? "Unquarantine" : "Quarantine"}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// --- Main component ---

export function FlakinessDashboard({ projectId }: { projectId: string }) {
  const [reports, setReports] = useState<FlakinessReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetUrl, setTargetUrl] = useState("");
  const [code, setCode] = useState("");
  const [runCount, setRunCount] = useState(5);
  const [triggering, setTriggering] = useState(false);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"history" | "detect">("history");

  const loadReports = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/flakiness`);
    if (res.ok) {
      const data = (await res.json()) as { reports: FlakinessReport[] };
      setReports(data.reports);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  // Poll for active report
  useEffect(() => {
    if (!activeReportId) return;
    const current = reports.find((r) => r.id === activeReportId);
    if (current && current.status !== "running") {
      setActiveReportId(null);
      return;
    }
    const timer = setInterval(async () => {
      const res = await fetch(
        `/api/projects/${projectId}/flakiness/${activeReportId}`,
      );
      if (res.ok) {
        const data = (await res.json()) as { report: FlakinessReport };
        setReports((prev) =>
          prev.map((r) => (r.id === activeReportId ? data.report : r)),
        );
        if (data.report.status !== "running") {
          setActiveReportId(null);
        }
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [activeReportId, projectId, reports]);

  const handleTrigger = async () => {
    if (!targetUrl || !code) return;
    setTriggering(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/flakiness`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl, generatedCode: code, runCount }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to start detection");
        return;
      }
      setActiveReportId(data.id!);
      // Optimistically add placeholder
      setReports((prev) => [
        {
          id: data.id!,
          testCaseId: null,
          targetUrl,
          totalRuns: 0,
          passCount: 0,
          failCount: 0,
          errorCount: 0,
          status: "running",
          flakinessScore: 0,
          quarantined: false,
          rootCause: null,
          suggestions: null,
          triggeredAt: new Date().toISOString(),
          completedAt: null,
          testCase: null,
        },
        ...prev,
      ]);
      setTab("history");
    } finally {
      setTriggering(false);
    }
  };

  const handleQuarantineToggle = async (id: string, quarantined: boolean) => {
    const res = await fetch(`/api/projects/${projectId}/flakiness/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quarantined }),
    });
    if (res.ok) {
      const data = (await res.json()) as { report: { id: string; quarantined: boolean } };
      setReports((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, quarantined: data.report.quarantined } : r,
        ),
      );
    }
  };

  const running = reports.filter((r) => r.status === "running");
  const flaky = reports.filter((r) => r.status === "flaky");
  const broken = reports.filter((r) => r.status === "broken");
  const stable = reports.filter((r) => r.status === "stable");

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Flaky", count: flaky.length, color: "text-yellow-600" },
          { label: "Broken", count: broken.length, color: "text-red-600" },
          { label: "Stable", count: stable.length, color: "text-green-600" },
          { label: "Running", count: running.length, color: "text-blue-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 text-center">
              <p className={`text-3xl font-bold ${stat.color}`}>
                {stat.count}
              </p>
              <p className="text-sm text-neutral-500">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-neutral-200">
        {(["history", "detect"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "border-b-2 border-neutral-900 text-neutral-900"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {t === "history" ? "Detection history" : "Run detection"}
          </button>
        ))}
      </div>

      {tab === "detect" ? (
        <Card>
          <CardHeader>
            <CardTitle>Run Flakiness Detection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fl-url">Target URL</Label>
              <Input
                id="fl-url"
                placeholder="https://example.com"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fl-runs">Number of runs</Label>
              <Input
                id="fl-runs"
                type="number"
                min={2}
                max={20}
                value={runCount}
                onChange={(e) => setRunCount(Number(e.target.value))}
                className="w-24"
              />
              <p className="text-xs text-neutral-500">
                The test is run this many times. Flakiness = failure rate.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fl-code">Automation code</Label>
              <textarea
                id="fl-code"
                className="h-48 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Paste your Playwright/automation code here…"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
            {error && (
              <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                {error}
              </p>
            )}
            <Button
              onClick={handleTrigger}
              disabled={triggering || !targetUrl || !code}
            >
              {triggering ? "Starting…" : `Run ${runCount}× and detect flakiness`}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {loading ? (
            <p className="py-8 text-center text-neutral-500">Loading…</p>
          ) : reports.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-200 py-12 text-center">
              <p className="font-medium text-neutral-700">
                No flakiness reports yet
              </p>
              <p className="mt-1 text-sm text-neutral-500">
                Run detection to find tests that randomly pass or fail.
              </p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => setTab("detect")}
              >
                Run detection
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {reports.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  projectId={projectId}
                  runCount={runCount}
                  onQuarantineToggle={handleQuarantineToggle}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
