import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — QA Copilot Suite",
  description: "Simple, transparent pricing. Start free in beta with your own Claude key.",
};

const tiers = [
  {
    name: "Free Beta",
    price: "$0",
    note: "Available now",
    highlight: true,
    cta: "Get Started",
    href: "/register",
    features: [
      "All 10 QA modules",
      "Test Case Generator + CSV / Gherkin export",
      "Automation code (Playwright, Selenium, REST Assured)",
      "Live Executor & Self-Healing",
      "Traceability Spine",
      "Bring your own Claude API key",
    ],
  },
  {
    name: "Pro",
    price: "Coming Soon",
    note: "For growing teams",
    highlight: false,
    cta: "Join Waitlist",
    href: "/register",
    features: [
      "Everything in Free Beta",
      "Managed AI (no key required)",
      "Team workspaces & roles",
      "Scheduled & CI-triggered runs",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    price: "Coming Soon",
    note: "For organizations",
    highlight: false,
    cta: "Contact Us",
    href: "/about",
    features: [
      "Everything in Pro",
      "SSO & audit logs",
      "Self-hosted / VPC deployment",
      "Custom framework adapters",
      "Dedicated success engineer",
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
      <div className="text-center">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">
          Pricing
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Simple,{" "}
          <span className="bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
            transparent pricing
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-slate-300">
          Start free during the beta. Bring your own Claude key and pay nothing —
          no credit card required.
        </p>
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`relative rounded-3xl border p-7 ${
              t.highlight
                ? "border-transparent bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-emerald-400/15 ring-1 ring-indigo-400/40"
                : "border-white/10 bg-white/[0.03]"
            }`}
          >
            {t.highlight && (
              <span className="absolute -top-3 left-7 rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 px-3 py-1 text-xs font-semibold text-white">
                Most popular
              </span>
            )}
            <h3 className="text-lg font-semibold text-white">{t.name}</h3>
            <p className="mt-1 text-xs text-slate-400">{t.note}</p>
            <p className="mt-4 text-3xl font-bold text-white">{t.price}</p>
            <ul className="mt-6 space-y-3">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={t.href}
              className={`mt-7 block rounded-full px-5 py-3 text-center text-sm font-semibold transition-transform hover:scale-[1.02] ${
                t.highlight
                  ? "bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400 text-white shadow-lg shadow-indigo-500/25"
                  : "border border-white/15 text-slate-200 hover:bg-white/5"
              }`}
            >
              {t.cta}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
