"use client";

import { useEffect, useState } from "react";

type Card = {
  icon: React.ReactNode;
  title: string;
  desc: string;
  stat: string;
  accent: string;
};

const I = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const cards: Card[] = [
  {
    icon: I("m18 16 4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16"),
    title: "Code You Own",
    desc: "Portable Playwright/Selenium TypeScript and REST Assured Java — standard frameworks, exportable any time. Zero lock-in.",
    stat: "Zero lock-in",
    accent: "from-indigo-500 to-violet-500",
  },
  {
    icon: I("M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3"),
    title: "Bring Your Own LLM Key",
    desc: "Use your own Claude or OpenAI key, stored encrypted. Transparent AI cost at provider rates — no token resale, no opaque credits.",
    stat: "Your key",
    accent: "from-violet-500 to-fuchsia-500",
  },
  {
    icon: I("M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83zM7 7h.01"),
    title: "Failure Intelligence",
    desc: "Every failed run is auto-classified — real bug, flaky, environment, or automation error — with two-layer self-healing on top.",
    stat: "Know why",
    accent: "from-rose-500 to-pink-500",
  },
  {
    icon: I("M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 9v6m0 6a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm12-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 0a9 9 0 0 1-9 9"),
    title: "Flakiness-Aware CI Gate",
    desc: "A GitHub Action that blocks PRs on real bugs but never on quarantined known-flaky tests. Ship on signal, not noise.",
    stat: "No flaky blocks",
    accent: "from-emerald-500 to-teal-400",
  },
  {
    icon: I("M21 12a9 9 0 1 1-3-6.7M21 3v6h-6"),
    title: "The Whole Loop",
    desc: "Requirement → test case → owned code → run → heal & classify → gate → report. One suite, fully traceable end to end.",
    stat: "End to end",
    accent: "from-emerald-400 to-indigo-500",
  },
];

export function HeroCarousel() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((p) => (p + 1) % cards.length), 4000);
    return () => clearInterval(t);
  }, [paused]);

  const go = (n: number) => setI((n + cards.length) % cards.length);

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-indigo-600/20 via-violet-600/10 to-emerald-500/20 blur-2xl" />
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-1 backdrop-blur-xl">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${i * 100}%)` }}
        >
          {cards.map((c, idx) => (
            <div key={idx} className="w-full shrink-0 p-7 sm:p-9">
              <div className={`inline-grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br ${c.accent} text-white shadow-lg`}>
                {c.icon}
              </div>
              <div className="mt-6 flex items-center gap-3">
                <h3 className="text-xl font-semibold text-white">{c.title}</h3>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                  {c.stat}
                </span>
              </div>
              <p className="mt-3 max-w-md text-[15px] leading-relaxed text-slate-300">
                {c.desc}
              </p>

              <div className="mt-7 space-y-2.5">
                {[100, 78, 56].map((w, k) => (
                  <div key={k} className="h-2.5 rounded-full bg-white/[0.06]">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${c.accent}`}
                      style={{ width: `${w}%` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <div className="flex gap-2">
          {cards.map((_, idx) => (
            <button
              key={idx}
              onClick={() => go(idx)}
              aria-label={`Slide ${idx + 1}`}
              className={`h-2 rounded-full transition-all ${
                idx === i ? "w-7 bg-gradient-to-r from-indigo-400 to-emerald-400" : "w-2 bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => go(i - 1)} aria-label="Previous" className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-slate-300 transition-colors hover:bg-white/5 hover:text-white">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button onClick={() => go(i + 1)} aria-label="Next" className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-slate-300 transition-colors hover:bg-white/5 hover:text-white">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
