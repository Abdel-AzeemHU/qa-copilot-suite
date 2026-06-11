"use client";

import { useState } from "react";

const problems = [
  {
    title: "Testing Takes Too Long",
    short: "Weeks → minutes",
    stat: "10x faster",
    detail:
      "Manually authoring test cases and automation scripts can take weeks per release. QA Copilot turns a user story into a prioritized, runnable suite in seconds — so coverage keeps pace with your sprints.",
  },
  {
    title: "High QA Costs",
    short: "$200K+ per year",
    stat: "$200K+",
    detail:
      "A dedicated automation engineer plus quote-gated enterprise tooling can run well over $200K annually. QA Copilot is self-serve with transparent pricing — and you bring your own LLM key, paying provider rates with no token resale.",
  },
  {
    title: "Inconsistent Coverage",
    short: "Hidden gaps",
    stat: "100% traceable",
    detail:
      "Hand-written suites drift and leave silent gaps. The Traceability Spine maps every test back to a requirement, so you can see exactly what is covered — and what is not — at a glance.",
  },
  {
    title: "Tests Break Constantly",
    short: "Endless maintenance",
    stat: "Auto-healed",
    detail:
      "Brittle selectors mean engineers spend more time fixing tests than writing features. Two-layer Self-Healing fixes selectors mid-test and repairs whole scripts after the run — keeping suites green automatically.",
  },
  {
    title: "Flaky Tests Block CI",
    short: "Noise stalls merges",
    stat: "Signal only",
    detail:
      "One flaky test can block every PR. QA Copilot classifies each failure as real bug, flaky, environment, or automation error — and its flakiness-aware merge gate blocks PRs on real bugs only, never on quarantined known-flaky tests.",
  },
];

export function ProblemTabs() {
  const [active, setActive] = useState(0);
  const p = problems[active];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {problems.map((pr, i) => (
          <button
            key={pr.title}
            onClick={() => setActive(i)}
            className={`rounded-2xl border p-5 text-left transition-all ${
              active === i
                ? "border-transparent bg-gradient-to-br from-indigo-500/20 via-violet-500/15 to-emerald-400/20 ring-1 ring-indigo-400/40"
                : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
            }`}
          >
            <p className="text-sm font-semibold text-white">{pr.title}</p>
            <p className="mt-1 text-xs text-slate-400">{pr.short}</p>
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-500/10 to-emerald-400/10 p-7 backdrop-blur-sm">
        <div className="flex flex-col items-start gap-5 md:flex-row md:items-center">
          <div className="bg-gradient-to-r from-indigo-300 to-emerald-300 bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-5xl">
            {p.stat}
          </div>
          <div>
            <h4 className="text-lg font-semibold text-white">{p.title}</h4>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-300">
              {p.detail}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
