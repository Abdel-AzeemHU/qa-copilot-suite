"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PRIORITIES, TEST_TYPES } from "@/lib/helpers/test-case-generator";

interface RecordedAction {
  type: string;
  target: string;
  value?: string;
  selector: string;
  humanText: string;
}

interface DraftTestCase {
  title: string;
  description: string;
  preconditions: string;
  expectedResult: string;
  priority: (typeof PRIORITIES)[number];
  type: (typeof TEST_TYPES)[number];
  suggestedAssertions: string[];
}

type Phase = "idle" | "recording" | "stopping" | "review" | "saving";

export function RecorderStudio({
  projectId,
  defaultStartUrl,
}: {
  projectId: string;
  defaultStartUrl: string;
}) {
  const router = useRouter();
  const [startUrl, setStartUrl] = useState(defaultStartUrl || "https://");
  const [phase, setPhase] = useState<Phase>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const [actions, setActions] = useState<RecordedAction[]>([]);
  const [rawCode, setRawCode] = useState("");
  const [draft, setDraft] = useState<DraftTestCase | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [savedRunId, setSavedRunId] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    setUnavailable(null);
    setPhase("recording");
    try {
      const res = await fetch(`/api/projects/${projectId}/recorder/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startUrl }),
      });
      const data = await res.json();
      if (res.status === 503) {
        setUnavailable(data.message ?? "Recorder unavailable.");
        setPhase("idle");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Failed to start recording.");
        setPhase("idle");
        return;
      }
      setSessionId(data.sessionId);
    } catch {
      setError("Network error starting the recorder.");
      setPhase("idle");
    }
  };

  const stop = async () => {
    if (!sessionId) return;
    setPhase("stopping");
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/recorder/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, startUrl }),
      });
      const data = await res.json();
      if (res.status === 503) {
        setUnavailable(data.message ?? "Recorder unavailable.");
        setPhase("idle");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Failed to stop recording.");
        setPhase("idle");
        return;
      }
      setActions(data.actions ?? []);
      setRawCode(data.rawCode ?? "");
      setAiError(data.aiError ?? null);
      if (data.testCase) {
        setDraft({
          title: data.testCase.title ?? "",
          description: data.testCase.description ?? "",
          preconditions: data.testCase.preconditions ?? "",
          expectedResult: data.testCase.expectedResult ?? "",
          priority: data.testCase.priority ?? "medium",
          type: data.testCase.type ?? "functional",
          suggestedAssertions: data.testCase.suggestedAssertions ?? [],
        });
      } else {
        setDraft({
          title: "Recorded test",
          description: "",
          preconditions: "",
          expectedResult: "",
          priority: "medium",
          type: "functional",
          suggestedAssertions: [],
        });
      }
      setSessionId(null);
      setPhase("review");
    } catch {
      setError("Network error stopping the recorder.");
      setPhase("recording");
    }
  };

  const save = async () => {
    if (!draft) return;
    setPhase("saving");
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/recorder/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawCode, actions, startUrl, testCase: draft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save.");
        setPhase("review");
        return;
      }
      setSavedRunId(data.automationRunId);
    } catch {
      setError("Network error saving the recording.");
      setPhase("review");
    }
  };

  const reset = () => {
    setPhase("idle");
    setActions([]);
    setRawCode("");
    setDraft(null);
    setSavedRunId(null);
    setError(null);
    setAiError(null);
  };

  return (
    <div className="space-y-6">
      <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
        Note: recording launches a real browser on the machine running this app.
        It works out of the box when you run Qaera locally
        (self-hosted). Cloud streaming is a planned future enhancement.
      </p>

      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {unavailable && (
        <div className="rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-3 text-sm text-blue-200 space-y-2">
          <p className="font-medium">Recording isn&apos;t available here</p>
          <p>{unavailable}</p>
          <p className="text-blue-300/80">
            See <span className="font-mono">docs/recorder.md</span> for setup
            details.
          </p>
        </div>
      )}

      {(phase === "idle" || phase === "recording") && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="startUrl">Start URL</Label>
            <Input
              id="startUrl"
              value={startUrl}
              onChange={(e) => setStartUrl(e.target.value)}
              placeholder="https://your-app.example.com/login"
              disabled={phase === "recording"}
            />
          </div>

          {phase === "idle" && (
            <Button onClick={start} disabled={!startUrl.startsWith("http")}>
              Start Recording
            </Button>
          )}

          {phase === "recording" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-200">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                Recording… perform your actions in the browser window that
                opened, then click Stop here.
              </div>
              <Button onClick={stop} variant="destructive">
                Stop Recording
              </Button>
            </div>
          )}
        </div>
      )}

      {phase === "stopping" && (
        <p className="text-sm text-muted-foreground">
          Stopping and analyzing your recording…
        </p>
      )}

      {phase === "review" && draft && (
        <div className="space-y-6">
          {savedRunId ? (
            <div className="space-y-3 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-3 text-sm text-green-200">
              <p className="font-medium">Saved!</p>
              <div className="flex gap-2">
                <Button
                  onClick={() =>
                    router.push(`/projects/${projectId}/execute`)
                  }
                >
                  Run now
                </Button>
                <Button variant="outline" onClick={reset}>
                  Record another
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Steps */}
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Recorded steps</h3>
                {actions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No actions were captured. Try recording again and interact
                    with the page.
                  </p>
                ) : (
                  <ol className="space-y-1 text-sm">
                    {actions.map((a, i) => (
                      <li
                        key={i}
                        className="flex gap-2 rounded-md border border-border/50 px-3 py-1.5"
                      >
                        <span className="text-muted-foreground">{i + 1}.</span>
                        <span>{a.humanText}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              {/* AI draft */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">AI-drafted test case</h3>
                  {aiError && (
                    <Badge variant="medium">AI draft unavailable</Badge>
                  )}
                </div>
                {aiError && (
                  <p className="text-xs text-amber-300/80">
                    {aiError}. You can still edit and save the test case below.
                  </p>
                )}

                <div className="space-y-2">
                  <Label htmlFor="tc-title">Title</Label>
                  <Input
                    id="tc-title"
                    value={draft.title}
                    onChange={(e) =>
                      setDraft({ ...draft, title: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tc-desc">Description</Label>
                  <textarea
                    id="tc-desc"
                    className="flex min-h-[72px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    value={draft.description}
                    onChange={(e) =>
                      setDraft({ ...draft, description: e.target.value })
                    }
                  />
                </div>

                <div className="flex gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="tc-priority">Priority</Label>
                    <select
                      id="tc-priority"
                      className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                      value={draft.priority}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          priority: e.target
                            .value as (typeof PRIORITIES)[number],
                        })
                      }
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tc-type">Type</Label>
                    <select
                      id="tc-type"
                      className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                      value={draft.type}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          type: e.target.value as (typeof TEST_TYPES)[number],
                        })
                      }
                    >
                      {TEST_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {draft.suggestedAssertions.length > 0 && (
                  <div className="space-y-1">
                    <Label>Suggested assertions</Label>
                    <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                      {draft.suggestedAssertions.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              {/* Code preview */}
              <section className="space-y-2">
                <button
                  type="button"
                  className="text-sm text-muted-foreground underline"
                  onClick={() => setShowCode((v) => !v)}
                >
                  {showCode ? "Hide" : "Show"} generated code (for developers)
                </button>
                {showCode && (
                  <pre className="max-h-72 overflow-auto rounded-md border border-border/50 bg-black/40 p-3 text-xs">
                    {rawCode || "(empty)"}
                  </pre>
                )}
              </section>

              <div className="flex gap-2">
                <Button onClick={save} disabled={!draft.title}>
                  Save &amp; Run
                </Button>
                <Button variant="outline" onClick={reset}>
                  Discard
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {phase === "saving" && (
        <p className="text-sm text-muted-foreground">Saving…</p>
      )}
    </div>
  );
}
