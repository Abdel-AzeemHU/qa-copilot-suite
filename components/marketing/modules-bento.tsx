const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  gen: "M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5z",
  code: "m18 16 4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16",
  plan: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  bug: "M8 2l1.5 1.5M16 2l-1.5 1.5M12 20v-9M5 13H2m20 0h-3M6 9a6 6 0 0 1 12 0v3a6 6 0 0 1-12 0z",
  review: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  chat: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  run: "M8 5v14l11-7z",
  heal: "M21 12a9 9 0 1 1-3-6.7M21 3v6h-6",
  trace: "M3 3v18h18M7 14l4-4 3 3 5-6",
  classify: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83zM7 7h.01",
  gate: "M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 9v6m0 6a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm12-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 0a9 9 0 0 1-9 9",
  record: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  api: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
};

export function ModulesBento() {
  return (
    <div className="mx-auto grid max-w-6xl auto-rows-[minmax(0,1fr)] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* Feature 1: Live Executor — large dark gradient with terminal */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-600/20 via-violet-600/10 to-emerald-500/15 p-6 sm:col-span-2 sm:row-span-2">
        <div className="mb-3 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-400 text-white">
            <Icon d={ICONS.run} />
          </span>
          <div>
            <h3 className="font-semibold text-white">Live Executor</h3>
            <p className="text-xs text-slate-400">Runs real tests against your app</p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-slate-300">
          Execute generated suites live in Playwright, Selenium, or REST Assured — with parallel runs and logs streaming back in real time.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-black/50 p-4 font-mono text-xs">
          <div className="mb-2 flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          </div>
          <p className="text-slate-400">$ qaera run --suite checkout</p>
          <p className="text-emerald-300">✓ add to cart updates subtotal (412ms)</p>
          <p className="text-emerald-300">✓ valid promo applies discount (388ms)</p>
          <p className="text-emerald-300">✓ invalid promo shows error (201ms)</p>
          <p className="mt-1 text-slate-400">3 passed · 0 failed · 1.0s</p>
        </div>
      </div>

      {[
        { k: "gen", name: "Test Case Generator", d: "Plain-English requirements become prioritized test suites with CSV/Gherkin export." },
        { k: "code", name: "Automation Code Generator", d: "Portable Playwright/Selenium TS & REST Assured Java — code you own, zero lock-in." },
        { k: "record", name: "In-Tool Test Recorder", d: "Record flows in the app itself — no browser extension required." },
      ].map((m) => (
        <Card key={m.k} k={m.k} name={m.name} d={m.d} />
      ))}

      {/* Feature 2: Self-Healing emerald */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-6 sm:col-span-2">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 text-white">
            <Icon d={ICONS.heal} />
          </span>
          <div>
            <h3 className="font-semibold text-white">Two-Layer Self-Healing</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">
              Layer one heals broken selectors mid-test so the run keeps going; layer two repairs the whole script after the run — your suite stays green without manual triage.
            </p>
          </div>
        </div>
      </div>

      {[
        { k: "classify", name: "AI Failure Classification", d: "Every failure labeled: real bug, flaky, environment, or automation error." },
        { k: "trace", name: "Flakiness Detection", d: "Run N times, score flakiness, quarantine, and get AI root-cause analysis." },
        { k: "gate", name: "Flakiness-Aware CI Gate", d: "GitHub Action blocks PRs on real bugs — never on known-flaky tests." },
        { k: "review", name: "Visual Regression", d: "Snapshot diffs with AI triage of real bugs vs. rendering noise." },
        { k: "api", name: "API Testing", d: "Import OpenAPI or Postman; AI generates functional, negative, edge & security tests." },
        { k: "bug", name: "Bug Reporter", d: "Turn failures into structured, reproducible reports." },
        { k: "plan", name: "Pipeline Orchestration", d: "Execute → heal → bug report → visual → notify, on one trigger." },
        { k: "chat", name: "Teams & Integrations", d: "Orgs, roles, audit logs, schedules — plus Slack, GitHub, Jira & webhooks." },
      ].map((m) => (
        <Card key={m.k} k={m.k} name={m.name} d={m.d} />
      ))}
    </div>
  );
}

function Card({ k, name, d }: { k: string; name: string; d: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition-colors hover:bg-white/[0.06]">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/[0.06] text-indigo-300">
        <Icon d={ICONS[k as keyof typeof ICONS]} />
      </span>
      <h3 className="mt-3 font-semibold text-white">{name}</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-400">{d}</p>
    </div>
  );
}

const stats = [
  { n: "14", l: "Workflow Steps", d: "M4 4h16v16H4z M4 12h16M12 4v16" },
  { n: "100%", l: "Code You Own", d: "m18 16 4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16" },
  { n: "3", l: "Frameworks", d: "m18 16 4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16" },
  { n: "4", l: "Failure Labels", d: "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83zM7 7h.01" },
  { n: "2-Layer", l: "Self-Healing", d: "M21 12a9 9 0 1 1-3-6.7M21 3v6h-6" },
  { n: "BYOK", l: "Your Own LLM Key", d: "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3" },
];

export function StatsBar() {
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map((s) => (
        <div key={s.l} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
          <span className="mx-auto grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-indigo-500/20 to-emerald-400/20 text-emerald-300">
            <Icon d={s.d} />
          </span>
          <p className="mt-2 bg-gradient-to-r from-indigo-300 to-emerald-300 bg-clip-text text-2xl font-bold text-transparent">
            {s.n}
          </p>
          <p className="text-xs font-medium text-slate-400">{s.l}</p>
        </div>
      ))}
    </div>
  );
}

export const FRAMEWORKS = ["Playwright", "Selenium", "REST Assured"];
