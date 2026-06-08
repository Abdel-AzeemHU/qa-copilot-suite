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
    icon: I("M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5z"),
    title: "AI Test Generation",
    desc: "Turn user stories into complete, prioritized test suites in seconds.",
    stat: "10x faster",
    accent: "from-indigo-500 to-violet-500",
  },
  {
    icon: I("M8 5v14l11-7z"),
    title: "Live Execution",
    desc: "Runs real Playwright, Selenium & REST Assured tests against your app.",
    stat: "Real runs",
    accent: "from-violet-500 to-fuchsia-500",
  },
  {
    icon: I("M21 12a9 9 0 1 1-3-6.7M21 3v6h-6"),
    title: "Self-Healing",
    desc: "Detects broken selectors and repairs failing tests automatically.",
    stat: "Auto-repair",
    accent: "from-emerald-500 to-teal-400",
  },
  {
    icon: I("M3 3v18h18M7 14l4-4 3 3 5-6"),
    title: "Traceability Spine",
    desc: "Every test traces back to a requirement. Full coverage, zero gaps.",
    stat: "100% traceable",
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
