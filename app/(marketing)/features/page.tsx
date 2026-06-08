import Link from "next/link";
import type { Metadata } from "next";
import { ModulesBento } from "@/components/marketing/modules-bento";
import { ClosedLoop } from "@/components/marketing/closed-loop";

export const metadata: Metadata = {
  title: "Features — QA Copilot Suite",
  description: "Ten modules across a five-step closed loop, from requirement to verified test.",
};

const detailed = [
  { name: "Test Case Generator", d: "Turn user stories and acceptance criteria into prioritized, categorized test cases. Export to CSV or Gherkin." },
  { name: "Automation Code Generator", d: "Generate runnable automation in Playwright, Selenium, or REST Assured straight from a test case." },
  { name: "Test Planner", d: "Organize coverage across epics, releases, and risk areas so nothing is left untested." },
  { name: "Bug Reporter", d: "Convert failing runs into structured, reproducible bug reports with steps and context." },
  { name: "Static Review", d: "AI peer review of test plans and automation code, catching gaps and anti-patterns before they ship." },
  { name: "QA Chat Assist", d: "Ask natural-language questions about coverage, strategy, and your existing suites." },
  { name: "Live Executor", d: "Run generated suites against your app and stream pass/fail results back in real time." },
  { name: "Self-Healing", d: "Detect broken selectors on failure and rewrite them automatically to keep suites green." },
  { name: "Traceability Spine", d: "Map every test back to a requirement for provable, gap-free coverage." },
  { name: "CSV / Gherkin Export", d: "Take your generated cases anywhere — spreadsheets, BDD frameworks, or your own tooling." },
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
          Ten modules that hand off to each other across a five-step lifecycle —
          from the first requirement to the final verified run.
        </p>
      </div>

      <div className="mt-16">
        <ClosedLoop />
      </div>

      <div className="mt-20">
        <h2 className="mb-8 text-center text-2xl font-bold text-white">The modules</h2>
        <ModulesBento />
      </div>

      <div className="mt-16">
        <h2 className="mb-8 text-center text-2xl font-bold text-white">
          Every module, in detail
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {detailed.map((m) => (
            <div key={m.name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h3 className="font-semibold text-white">{m.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{m.d}</p>
            </div>
          ))}
        </div>
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
