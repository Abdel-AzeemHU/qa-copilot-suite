import Link from "next/link";
import type { Metadata } from "next";
import { HeroCarousel } from "@/components/marketing/hero-carousel";
import { ClosedLoop } from "@/components/marketing/closed-loop";
import { LiveDemo } from "@/components/marketing/live-demo";
import { ModulesBento, StatsBar } from "@/components/marketing/modules-bento";
import { ProblemTabs } from "@/components/marketing/problem-tabs";

export const metadata: Metadata = {
  title: "QA Copilot Suite — Closed-loop QA automation",
  description:
    "Generate test cases, write automation code, run it live, heal what breaks, and trace everything back to the requirement.",
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
                Start Generating →
              </Link>
              <a
                href="#live-demo"
                className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/5"
              >
                See How It Works
              </a>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1">
                Powered by Claude
              </span>
              <span className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1">
                claude-opus-4-8
              </span>
              <span className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1">
                Bring your own key
              </span>
            </div>
          </div>
          <HeroCarousel />
        </div>
      </section>

      {/* CLOSED LOOP */}
      <section className="border-y border-white/10 bg-white/[0.015] py-20">
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

      {/* LIVE DEMO */}
      <section id="live-demo" className="scroll-mt-20 py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mb-12 text-center">
            <Eyebrow>Interactive demo</Eyebrow>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Watch AI Generate Tests in Real-Time
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-300">
              Pick a scenario, hit generate, and see a prioritized test suite
              appear — exactly how it works inside the app.
            </p>
          </div>
          <LiveDemo />
        </div>
      </section>

      {/* MODULES */}
      <section className="border-y border-white/10 bg-white/[0.015] py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mb-12 text-center">
            <Eyebrow>The suite</Eyebrow>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ten modules, one closed loop
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
