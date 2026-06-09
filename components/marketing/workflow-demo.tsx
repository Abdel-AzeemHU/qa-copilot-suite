"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const STAGE_COLORS = {
  setup: {
    badge: "from-sky-500 to-blue-600",
    text: "text-sky-400",
    border: "border-sky-500/30",
    bg: "bg-sky-500/10",
  },
  ai: {
    badge: "from-violet-500 to-purple-600",
    text: "text-violet-400",
    border: "border-violet-500/30",
    bg: "bg-violet-500/10",
  },
  execution: {
    badge: "from-emerald-500 to-teal-600",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
  },
  integration: {
    badge: "from-amber-500 to-orange-600",
    text: "text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
  },
  pipeline: {
    badge: "from-indigo-500 to-indigo-700",
    text: "text-indigo-400",
    border: "border-indigo-500/30",
    bg: "bg-indigo-500/10",
  },
} as const;

type Stage = keyof typeof STAGE_COLORS;

interface StatDef {
  label: string;
  value: number;
  suffix: string;
}

interface Step {
  id: number;
  title: string;
  subtitle: string;
  stage: Stage;
  activity: string;
  stats: [StatDef, StatDef];
  icon: string;
}

const STEPS: Step[] = [
  {
    id: 1,
    title: "Connect Your Project",
    subtitle: "Link repo, describe app, set target URL",
    stage: "setup",
    activity: "Scanning repository structure and inferring project type from package manifests and config files…",
    stats: [
      { label: "Files Scanned", value: 312, suffix: "" },
      { label: "Context Tokens", value: 8400, suffix: "" },
    ],
    icon: "M13.828 10.172a4 4 0 0 0-5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0-5.656-5.656l-1.1 1.1",
  },
  {
    id: 2,
    title: "Feed LLM with Context",
    subtitle: "Ingest requirements, stories, acceptance criteria",
    stage: "setup",
    activity: "Parsing 47 user stories and 23 acceptance criteria into structured context chunks for the model…",
    stats: [
      { label: "Stories Ingested", value: 47, suffix: "" },
      { label: "Criteria Parsed", value: 23, suffix: "" },
    ],
    icon: "M4 6h16M4 12h16M4 18h7",
  },
  {
    id: 3,
    title: "AI Requirement Review",
    subtitle: "Gap analysis, ambiguity detection, edge case audit",
    stage: "ai",
    activity: "Scanning 47 user stories for missing edge cases, conflicting acceptance criteria, and underspecified flows…",
    stats: [
      { label: "Gaps Found", value: 14, suffix: "" },
      { label: "Ambiguities", value: 6, suffix: "" },
    ],
    icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  },
  {
    id: 4,
    title: "Generate Test Cases",
    subtitle: "Structured cases with priority, category, Gherkin/CSV export",
    stage: "ai",
    activity: "Generating prioritized test cases with scenario grouping, severity ratings, and Gherkin syntax export…",
    stats: [
      { label: "Cases Generated", value: 284, suffix: "" },
      { label: "Coverage", value: 92, suffix: "%" },
    ],
    icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2m-6 9l2 2 4-4",
  },
  {
    id: 5,
    title: "Build Test Plan",
    subtitle: "Organize into coherent phases with coverage mapping",
    stage: "ai",
    activity: "Arranging 284 test cases into phased sprints, grouping by risk area and linking to epics…",
    stats: [
      { label: "Phases Created", value: 4, suffix: "" },
      { label: "Epics Covered", value: 11, suffix: "" },
    ],
    icon: "M9 17V7m0 10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m0 10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m0 10V7m0 10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2",
  },
  {
    id: 6,
    title: "Generate Automation Code",
    subtitle: "Playwright scripts from test cases, ready to run",
    stage: "ai",
    activity: "Synthesising runnable Playwright TypeScript from 284 test cases, with page object patterns and fixtures…",
    stats: [
      { label: "Scripts Generated", value: 284, suffix: "" },
      { label: "Lines of Code", value: 4200, suffix: "" },
    ],
    icon: "m18 16 4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16",
  },
  {
    id: 7,
    title: "Execute Tests",
    subtitle: "Run live against your URL, stream logs in real time",
    stage: "execution",
    activity: "Running suite against https://app.example.com — streaming browser events, screenshots on failure…",
    stats: [
      { label: "Running", value: 180, suffix: "" },
      { label: "Passed", value: 172, suffix: "" },
    ],
    icon: "M8 5v14l11-7z",
  },
  {
    id: 8,
    title: "Self-Healing",
    subtitle: "AI diagnoses and patches broken code automatically",
    stage: "execution",
    activity: "8 selectors broke after a UI update — AI is diagnosing DOM changes and rewriting locators now…",
    stats: [
      { label: "Failures Detected", value: 8, suffix: "" },
      { label: "Auto-Healed", value: 8, suffix: "" },
    ],
    icon: "M21 12a9 9 0 1 1-3-6.7M21 3v6h-6",
  },
  {
    id: 9,
    title: "Bug Reporting",
    subtitle: "AI-structured reports with severity, steps, labels",
    stage: "execution",
    activity: "Filing 3 confirmed regressions with reproduction steps, severity P2, and relevant screenshots attached…",
    stats: [
      { label: "Bugs Filed", value: 3, suffix: "" },
      { label: "Severity", value: 2, suffix: " (P2)" },
    ],
    icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  },
  {
    id: 10,
    title: "Jira & Integrations",
    subtitle: "Sync to Jira, push to Slack, trigger GitHub webhooks",
    stage: "integration",
    activity: "Pushing 3 bug reports to Jira project QA-42, notifying #qa-alerts Slack channel, firing webhook…",
    stats: [
      { label: "Jira Tickets", value: 3, suffix: "" },
      { label: "Webhooks Fired", value: 5, suffix: "" },
    ],
    icon: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 1 1 0-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 1 0 5.367-2.684 3 3 0 0 0-5.367 2.684zm0 9.316a3 3 0 1 0 5.368 2.684 3 3 0 0 0-5.368-2.684z",
  },
  {
    id: 11,
    title: "Pipeline Orchestration",
    subtitle: "Full chain: generate → execute → heal → report → notify",
    stage: "pipeline",
    activity: "Orchestrating complete pipeline: 12 stages chained — 9 complete, 3 in-flight, ETA 42 seconds…",
    stats: [
      { label: "Stages Complete", value: 9, suffix: "/12" },
      { label: "ETA", value: 42, suffix: "s" },
    ],
    icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15",
  },
  {
    id: 12,
    title: "Smart Scheduling",
    subtitle: "Trigger on schedule, CI event, or on-demand",
    stage: "pipeline",
    activity: "Monitoring 4 schedules: nightly regression at 02:00 UTC, CI-triggered on every PR, on-demand always ready…",
    stats: [
      { label: "Active Schedules", value: 4, suffix: "" },
      { label: "Runs This Week", value: 37, suffix: "" },
    ],
    icon: "M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  },
];

const STAGE_LABELS: Record<Stage, string> = {
  setup: "Setup",
  ai: "AI Generation",
  execution: "Execution",
  integration: "Integrations",
  pipeline: "Pipeline",
};

function SvgIcon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

function useCountUp(target: number, triggerKey: number) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setValue(0);
    const start = performance.now();
    const duration = 600;
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey]);

  return value;
}

function StatCounter({ stat, triggerKey }: { stat: StatDef; triggerKey: number }) {
  const value = useCountUp(stat.value, triggerKey);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-2xl font-bold tabular-nums text-white">
        {value.toLocaleString()}{stat.suffix}
      </span>
      <span className="text-xs text-slate-400">{stat.label}</span>
    </div>
  );
}

export function WorkflowDemo() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [hovering, setHovering] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const step = STEPS[activeIndex];
  const colors = STAGE_COLORS[step.stage];
  const progress = ((activeIndex + 1) / STEPS.length) * 100;

  const advance = useCallback(() => {
    setActiveIndex((i) => (i + 1) % STEPS.length);
  }, []);

  useEffect(() => {
    if (playing && !hovering) {
      intervalRef.current = setInterval(advance, 4000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, hovering, advance]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        {/* Left: step list (desktop only) */}
        <div className="hidden w-52 shrink-0 lg:block">
          <div className="sticky top-24 space-y-0.5">
            {STEPS.map((s, i) => {
              const c = STAGE_COLORS[s.stage];
              const isActive = i === activeIndex;
              return (
                <button
                  key={s.id}
                  onClick={() => { setActiveIndex(i); setPlaying(false); }}
                  className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all ${
                    isActive
                      ? `${c.bg} ${c.border} border`
                      : "border border-transparent hover:bg-white/[0.04]"
                  }`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${c.badge} text-[9px] font-bold text-white`}>
                    {s.id}
                  </span>
                  <span className={`truncate text-xs font-medium ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"}`}>
                    {s.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: main card */}
        <div
          className="flex-1"
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
        >
          <div className={`relative overflow-hidden rounded-2xl border bg-slate-900/80 backdrop-blur-sm ${colors.border} shadow-xl`}>
            {/* Top bar */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${colors.bg} ${colors.text} border ${colors.border}`}>
                  {STAGE_LABELS[step.stage]}
                </span>
                <span className="text-xs text-slate-500">Step {step.id} of {STEPS.length}</span>
              </div>
              <button
                onClick={() => setPlaying((p) => !p)}
                className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs text-slate-300 transition-colors hover:bg-white/10"
              >
                {playing && !hovering ? (
                  <>
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" rx="1"/>
                      <rect x="14" y="4" width="4" height="16" rx="1"/>
                    </svg>
                    Pause
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
                      <polygon points="5,3 19,12 5,21"/>
                    </svg>
                    Play
                  </>
                )}
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-0.5 bg-white/5">
              <div
                className={`h-full bg-gradient-to-r ${colors.badge} transition-all duration-700`}
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Card body */}
            <div className="p-6 sm:p-8">
              <div className="flex items-start gap-5">
                <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${colors.badge} shadow-lg`}>
                  <SvgIcon d={step.icon} className="h-7 w-7 text-white" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br ${colors.badge} text-xs font-bold text-white shrink-0`}>
                      {step.id}
                    </span>
                    <h3 className="text-xl font-bold text-white">{step.title}</h3>
                  </div>
                  <p className={`mt-1 text-sm font-medium ${colors.text}`}>{step.subtitle}</p>
                </div>
              </div>

              {/* Activity */}
              <div className="mt-6 rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-sm leading-relaxed text-slate-300">
                <div className="mb-2 flex items-center gap-1.5">
                  <span className={`h-2 w-2 animate-pulse rounded-full bg-gradient-to-br ${colors.badge}`} />
                  <span className="text-xs text-slate-500">Live activity</span>
                </div>
                {step.activity}
              </div>

              {/* Stats */}
              <div className="mt-6 grid grid-cols-2 gap-4">
                {step.stats.map((stat) => (
                  <div key={stat.label} className={`rounded-xl border ${colors.border} ${colors.bg} p-4 text-center`}>
                    <StatCounter stat={stat} triggerKey={activeIndex} />
                  </div>
                ))}
              </div>
            </div>

            {/* Footer: navigation */}
            <div className="flex items-center justify-between border-t border-white/10 px-5 py-3">
              <div className="flex flex-wrap gap-1">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => { setActiveIndex(i); setPlaying(false); }}
                    className={`rounded-full transition-all duration-300 ${
                      i === activeIndex
                        ? `h-2 w-5 bg-gradient-to-r ${colors.badge}`
                        : "h-2 w-2 bg-white/20 hover:bg-white/40"
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setActiveIndex((i) => (i - 1 + STEPS.length) % STEPS.length); setPlaying(false); }}
                  className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-white/10"
                >
                  ← Prev
                </button>
                <button
                  onClick={() => { advance(); setPlaying(false); }}
                  className={`rounded-lg bg-gradient-to-r ${colors.badge} px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90`}
                >
                  Next Step →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
