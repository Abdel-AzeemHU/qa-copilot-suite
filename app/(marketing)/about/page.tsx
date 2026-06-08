import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — QA Copilot Suite",
  description: "Our mission: close the loop between requirements and verified tests.",
};

const values = [
  {
    title: "Close the loop",
    body: "Generation alone is half a solution. We carry every requirement all the way to a verified, passing test — and keep it there.",
  },
  {
    title: "Bring your own key",
    body: "Your AI usage, your control. Keys are encrypted at rest with AES-256-GCM and never shared.",
  },
  {
    title: "Coverage you can trust",
    body: "The Traceability Spine maps tests to requirements so coverage is provable, not assumed.",
  },
  {
    title: "Built for dev teams",
    body: "Playwright, Selenium, and REST Assured output that drops straight into the pipelines you already run.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-20 sm:px-8">
      <div className="text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">
          Our mission
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          QA should keep pace with{" "}
          <span className="bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
            the speed you ship.
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">
          QA Copilot Suite was built on a simple conviction: testing should not
          be the bottleneck between an idea and a release. By chaining AI
          generation, live execution, and self-healing into a single closed
          loop, we turn requirements into verified coverage — automatically.
        </p>
      </div>

      <div className="mt-16 grid gap-5 sm:grid-cols-2">
        {values.map((v) => (
          <div
            key={v.title}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
          >
            <h3 className="font-semibold text-white">{v.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{v.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-16 rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/10 to-emerald-400/10 p-10 text-center">
        <h2 className="text-2xl font-bold text-white">
          Help us shape the loop
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-300">
          QA Copilot is in open beta. Try it free, send us feedback, and help
          define what closed-loop QA looks like.
        </p>
        <Link
          href="/register"
          className="mt-6 inline-block rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-transform hover:scale-[1.03]"
        >
          Get Started Free →
        </Link>
      </div>
    </div>
  );
}
