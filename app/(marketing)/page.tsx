import Link from "next/link";
import type { Metadata } from "next";
import { HeroCarousel } from "@/components/marketing/hero-carousel";
import { ClosedLoop } from "@/components/marketing/closed-loop";
import { WorkflowDemo } from "@/components/marketing/workflow-demo";
import { ModulesBento, StatsBar } from "@/components/marketing/modules-bento";
import { ProblemTabs } from "@/components/marketing/problem-tabs";
import { SocialProof } from "@/components/marketing/social-proof";

export const metadata: Metadata = {
  title: "QA Copilot Suite — Closed-loop QA automation",
  description:
    "Generate test cases, write automation code, run it live, heal what breaks, and trace everything back to the requirement.",
  openGraph: {
    title: "QA Copilot Suite — Closed-loop QA automation",
    description:
      "Generate test cases, write automation code, run it live, heal what breaks, and trace everything back to the requirement.",
    type: "website",
  },
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">
      {children}
    </p>
  );
}

export default function Home() {
  return (
    <div className="overflow-hidden">
      {/* HERO */}
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-10%] h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-br from-indigo-600/30 via-violet-600/20 to-emerald-500/20 blur-[120px]" />
        </div>
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-emerald-300">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              CLOSED-LOOP QA AUTOMATION
            </span>
            <h1 className="mt-5 text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
              From requirement to{" "}
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-emerald-400 bg-clip-text text-transparent">
                verified test
              </span>{" "}
              — autonomously.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
              The only QA suite that generates test cases, writes automation
              code, runs it live, heals what breaks, and traces everything back
              to the requirement.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-transform hover:scale-[1.03]"
              >
                Start Free →
              </Link>
              <a
                href="#workflow-demo"
                className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/5"
              >
                See it work ↓
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
              {[
                "Works with Playwright",
                "Claude & OpenAI",
                "Jira",
                "Slack",
                "GitHub",
              ].map((item, i, arr) => (
                <span key={item} className="flex items-center gap-2">
                  <span className="text-slate-300">{item}</span>
                  {i < arr.length - 1 && <span className="text-slate-600">•</span>}
                </span>
              ))}
            </div>
          </div>
          <HeroCarousel />
        </div>
      </section>

      {/* WORKFLOW DEMO — 12-step interactive */}
      <section id="workflow-demo" className="scroll-mt-20 border-y border-white/10 bg-white/[0.015] py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mb-12 text-center">
            <Eyebrow>Interactive workflow</Eyebrow>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              See every step of the workflow
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-300">
              Walk through all 12 stages — from connecting your repo to
              fully-automated, always-on QA — with live activity and real
              metrics at each step.
            </p>
          </div>
          <WorkflowDemo />
          <div className="mt-10 text-center">
            <Link
              href="/register"
              className="inline-block rounded-full border border-indigo-400/40 bg-indigo-500/10 px-6 py-3 text-sm font-semibold text-indigo-300 transition-colors hover:bg-indigo-500/20 hover:text-indigo-200"
            >
              Start your first pipeline →
            </Link>
          </div>
        </div>
      </section>

      {/* CLOSED LOOP */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-5 text-center sm:px-8">
          <Eyebrow>The differentiator</Eyebrow>
          <h2 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Competitors stop at generation.{" "}
            <span className="bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
              We close the loop.
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-300">
            Every requirement flows through the full lifecycle — and back again —
            so nothing slips through untested.
          </p>
          <div className="mt-14">
            <ClosedLoop />
          </div>
        </div>
      </section>

      {/* MODULES */}
      <section className="border-y border-white/10 bg-white/[0.015] py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mb-12 text-center">
            <Eyebrow>The suite</Eyebrow>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Twelve capabilities, one closed loop
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-300">
              Each module hands off to the next — from the first requirement to
              the final verified run.
            </p>
          </div>
          <ModulesBento />
        </div>
      </section>

      {/* STATS */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <StatsBar />
        </div>
      </section>

      {/* PROBLEM TABS */}
      <section className="border-t border-white/10 bg-white/[0.015] py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mb-12 text-center">
            <Eyebrow>Why teams need this</Eyebrow>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              The QA bottleneck, solved
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-300">
              Select a challenge to see how QA Copilot closes the gap.
            </p>
          </div>
          <ProblemTabs />
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="border-t border-white/10">
        <SocialProof />
      </section>

      {/* FINAL CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <div className="rounded-3xl border border-transparent bg-gradient-to-br from-indigo-500/20 via-violet-500/15 to-emerald-400/20 p-[1px]">
            <div className="rounded-3xl bg-[#0a0b14] px-8 py-16 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
                Ready to{" "}
                <span className="bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
                  close the loop?
                </span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-slate-300">
                Generate, run, and verify your first test suite in minutes.
              </p>
              <div className="mt-8 flex justify-center">
                <Link
                  href="/register"
                  className="rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-transform hover:scale-[1.03]"
                >
                  Start Generating Free →
                </Link>
              </div>
              <p className="mt-4 text-xs text-slate-400">
                No credit card. Bring your own Claude key.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
