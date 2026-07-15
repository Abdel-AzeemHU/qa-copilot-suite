import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — Qaera",
  description: "Our mission: close the loop between requirements and verified tests, automatically.",
  openGraph: {
    title: "About — Qaera",
    description: "Our mission: close the loop between requirements and verified tests, automatically.",
    type: "website",
  },
};

const team = [
  {
    initials: "AK",
    name: "Arjun Kapoor",
    role: "Engineering Lead",
    bio: "10 years building test infrastructure at scale. Previously led QA platform at a Series D fintech.",
    accent: "from-indigo-500 to-violet-500",
  },
  {
    initials: "ML",
    name: "Maya Lim",
    role: "Head of Product",
    bio: "Spent five years as a QA manager before switching to product. Obsessed with turning toil into automation.",
    accent: "from-violet-500 to-emerald-400",
  },
  {
    initials: "TR",
    name: "Tom Rourke",
    role: "Design Lead",
    bio: "Believes developer tools should feel like consumer products. Passionate about information density without clutter.",
    accent: "from-emerald-500 to-teal-400",
  },
];

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
      {/* Mission */}
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
          Qaera was built on a simple conviction: testing should not
          be the bottleneck between an idea and a release. By chaining AI
          generation, live execution, and self-healing into a single closed
          loop, we turn requirements into verified coverage — automatically.
        </p>
      </div>

      {/* How it works */}
      <div className="mt-16 space-y-8">
        <h2 className="text-2xl font-bold text-white">How it works</h2>
        <div className="space-y-6 text-slate-300">
          <p className="leading-relaxed">
            <span className="font-semibold text-white">The problem.</span>{" "}
            Software teams ship faster than ever — but QA hasn't kept up. Test suites are written
            by hand, maintained by hand, and break silently when UIs change. The result: coverage
            gaps, release anxiety, and engineers spending nights chasing flaky locators instead of
            building features. Most AI tools make generation easier, but stop there, leaving the
            execution, maintenance, and reporting work untouched.
          </p>
          <p className="leading-relaxed">
            <span className="font-semibold text-white">The solution.</span>{" "}
            Qaera connects every stage of the QA lifecycle into one pipeline. You paste
            in a requirement, and the AI reviews it for gaps, generates a prioritized set of test
            cases, writes runnable Playwright automation code, and immediately runs it against your
            app. Failures trigger the self-healing engine, which diagnoses DOM changes and rewrites
            broken selectors. Real bugs become structured Jira tickets. Everything links back to
            the original requirement through the Traceability Spine — so coverage is always provable.
          </p>
          <p className="leading-relaxed">
            <span className="font-semibold text-white">The closed loop.</span>{" "}
            The pipeline doesn't run once and stop. Smart Scheduling keeps it always on — triggered
            by cron, CI events (PR opens, merge to main), or manual runs. When your app changes,
            the loop adapts. Self-healing patches selectors. New requirements feed new test cases.
            Your coverage stays complete without a dedicated QA team writing tests from scratch
            every sprint.
          </p>
        </div>
      </div>

      {/* Values */}
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

      {/* Team */}
      <div className="mt-20">
        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">
          The team
        </div>
        <h2 className="text-2xl font-bold text-white">Built by people who lived the problem</h2>
        <p className="mt-3 text-slate-400">
          Illustrative team — Qaera is in open beta.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {team.map((member) => (
            <div
              key={member.name}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <div className={`inline-grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${member.accent} text-xl font-bold text-white shadow-lg`}>
                {member.initials}
              </div>
              <h3 className="mt-4 font-semibold text-white">{member.name}</h3>
              <p className="text-xs font-medium text-indigo-400">{member.role}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{member.bio}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-16 rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/10 to-emerald-400/10 p-10 text-center">
        <h2 className="text-2xl font-bold text-white">
          Help us shape the loop
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-300">
          Qaera is in open beta. Try it free, send us feedback, and help
          define what closed-loop QA looks like.
        </p>
        <Link
          href="/register"
          className="mt-6 inline-block rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-transform hover:scale-[1.03]"
        >
          Join us →
        </Link>
      </div>
    </div>
  );
}
