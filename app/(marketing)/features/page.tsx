import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Features — QA Copilot Suite",
  description: "12 capabilities across a closed-loop QA pipeline — from requirement to verified test.",
};

function SvgIcon({ d, className = "h-5 w-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const GROUPS = [
  {
    id: "ai-generation",
    label: "AI Generation",
    color: "from-violet-500 to-purple-600",
    textColor: "text-violet-400",
    borderColor: "border-violet-500/30",
    bgColor: "bg-violet-500/10",
    features: [
      {
        icon: "M13.828 10.172a4 4 0 0 0-5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.101m-.758-4.899a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0-5.656-5.656l-1.1 1.1",
        name: "Project Connection",
        desc: "Link your repository, describe your application, and set target URLs. QA Copilot scans your codebase context automatically.",
        badge: "Setup",
      },
      {
        icon: "M4 6h16M4 12h16M4 18h7",
        name: "Context Ingestion",
        desc: "Feed in user stories, acceptance criteria, and requirement docs. The AI structures them into rich context chunks for generation.",
        badge: "Setup",
      },
      {
        icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
        name: "AI Requirement Review",
        desc: "Before generating a single test, the AI audits your requirements for gaps, ambiguities, and missing edge cases.",
        badge: "AI",
      },
      {
        icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2m-6 9l2 2 4-4",
        name: "Test Case Generator",
        desc: "Turn user stories and acceptance criteria into prioritized, categorized test cases. Export to CSV or Gherkin in one click.",
        badge: "AI",
      },
      {
        icon: "M9 17V7m0 10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m0 10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m0 10V7m0 10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2",
        name: "Test Plan Builder",
        desc: "Organize generated cases into phased, risk-weighted plans. Map coverage across epics, sprints, and release milestones.",
        badge: "AI",
      },
      {
        icon: "m18 16 4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16",
        name: "Automation Code Generator",
        desc: "Generate runnable Playwright TypeScript from test cases, complete with page object patterns, fixtures, and assertions.",
        badge: "AI",
      },
    ],
  },
  {
    id: "test-execution",
    label: "Test Execution",
    color: "from-emerald-500 to-teal-600",
    textColor: "text-emerald-400",
    borderColor: "border-emerald-500/30",
    bgColor: "bg-emerald-500/10",
    features: [
      {
        icon: "M8 5v14l11-7z",
        name: "Live Executor",
        desc: "Run generated suites live against your app URL and watch pass/fail results stream back in real time — no CI setup required.",
        badge: "Execution",
      },
      {
        icon: "M21 12a9 9 0 1 1-3-6.7M21 3v6h-6",
        name: "Self-Healing Engine",
        desc: "When selectors break after a UI update, the AI diagnoses the DOM diff and rewrites locators automatically — suites stay green.",
        badge: "Execution",
      },
      {
        icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
        name: "Bug Reporter",
        desc: "Convert failing runs into structured bug reports with severity, reproduction steps, screenshots, and labels — filed automatically.",
        badge: "Execution",
      },
    ],
  },
  {
    id: "integrations",
    label: "Integrations & Automation",
    color: "from-amber-500 to-orange-600",
    textColor: "text-amber-400",
    borderColor: "border-amber-500/30",
    bgColor: "bg-amber-500/10",
    features: [
      {
        icon: "M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 1 1 0-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 1 0 5.367-2.684 3 3 0 0 0-5.367 2.684zm0 9.316a3 3 0 1 0 5.368 2.684 3 3 0 0 0-5.368-2.684z",
        name: "Jira & Integrations",
        desc: "Sync bug reports to Jira, push notifications to Slack, and trigger GitHub webhooks — all from a single run.",
        badge: "Integration",
      },
      {
        icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15",
        name: "Pipeline Orchestration",
        desc: "Chain the full workflow: generate → execute → heal → report → notify. Run the complete loop with one trigger.",
        badge: "Pipeline",
      },
      {
        icon: "M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
        name: "Smart Scheduling",
        desc: "Trigger runs on a cron schedule, on CI events (PR opens, merge), or on-demand — always-on QA without manual intervention.",
        badge: "Pipeline",
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
      <div className="text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">
          Features
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Everything you need to{" "}
          <span className="bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
            close the loop
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-slate-300">
          12 capabilities across 4 stage groups — from the first requirement to
          always-on, self-healing QA.
        </p>
      </div>

      <div className="mt-16 space-y-16">
        {GROUPS.map((group) => (
          <div key={group.id}>
            <div className="mb-6 flex items-center gap-3">
              <span className={`inline-flex items-center rounded-full bg-gradient-to-r ${group.color} px-3 py-1 text-xs font-semibold text-white`}>
                {group.label}
              </span>
              <div className="flex-1 border-t border-white/10" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {group.features.map((f) => (
                <div
                  key={f.name}
                  className={`group rounded-2xl border ${group.borderColor} bg-white/[0.03] p-6 transition-colors hover:${group.bgColor}`}
                >
                  <div className="flex items-start gap-4">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${group.color} shadow-lg`}>
                      <SvgIcon d={f.icon} className="h-5 w-5 text-white" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{f.name}</h3>
                        <span className={`rounded-md border ${group.borderColor} ${group.bgColor} ${group.textColor} px-1.5 py-0.5 text-[10px] font-semibold`}>
                          {f.badge}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16 text-center">
        <Link
          href="/register"
          className="inline-block rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-transform hover:scale-[1.03]"
        >
          Start Generating Free →
        </Link>
      </div>
    </div>
  );
}
