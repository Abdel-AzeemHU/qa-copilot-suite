"use client";

import Link from "next/link";
import { useState } from "react";

const TIERS = [
  {
    name: "Starter",
    priceMonthly: 0,
    priceAnnual: 0,
    priceLabel: "Free",
    note: "1 project · 10 runs/month",
    highlight: false,
    cta: "Get Started Free",
    href: "/register",
    features: [
      "1 project",
      "10 pipeline runs/month",
      "1 team member",
      "Test Case Generator + CSV/Gherkin export",
      "AI Requirement Review",
      "Bring your own Claude API key",
      "Community support",
    ],
  },
  {
    name: "Team",
    priceMonthly: 49,
    priceAnnual: 39,
    priceLabel: "$49",
    note: "10 projects · 50 runs/month",
    highlight: true,
    cta: "Start 14-day Trial",
    href: "/register",
    features: [
      "10 projects",
      "50 pipeline runs/month",
      "Up to 20 members",
      "All AI modules (generator, planner, code gen)",
      "Live Executor + Self-Healing",
      "Jira, Slack & GitHub integrations",
      "Smart scheduling & pipeline orchestration",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    priceMonthly: null,
    priceAnnual: null,
    priceLabel: "Custom",
    note: "Unlimited · SLA included",
    highlight: false,
    cta: "Talk to Sales",
    href: "/about",
    features: [
      "Unlimited projects & runs",
      "Unlimited members",
      "SSO (SAML/OIDC)",
      "Audit log & compliance exports",
      "Dedicated SLA (99.9% uptime)",
      "Custom framework adapters",
      "Dedicated success engineer",
    ],
  },
];

const COMPARISON = [
  { feature: "Projects", starter: "1", team: "10", enterprise: "Unlimited" },
  { feature: "Pipeline runs/month", starter: "10", team: "50", enterprise: "Unlimited" },
  { feature: "Team members", starter: "1", team: "20", enterprise: "Unlimited" },
  { feature: "Test Case Generator", starter: true, team: true, enterprise: true },
  { feature: "AI Requirement Review", starter: true, team: true, enterprise: true },
  { feature: "Test Plan Builder", starter: false, team: true, enterprise: true },
  { feature: "Automation Code Generator", starter: false, team: true, enterprise: true },
  { feature: "Live Executor", starter: false, team: true, enterprise: true },
  { feature: "Self-Healing", starter: false, team: true, enterprise: true },
  { feature: "Bug Reporter", starter: false, team: true, enterprise: true },
  { feature: "Jira / Slack / GitHub sync", starter: false, team: true, enterprise: true },
  { feature: "Pipeline Orchestration", starter: false, team: true, enterprise: true },
  { feature: "Smart Scheduling", starter: false, team: true, enterprise: true },
  { feature: "SSO & Audit Log", starter: false, team: false, enterprise: true },
  { feature: "SLA", starter: false, team: false, enterprise: true },
];

const FAQ = [
  {
    q: "What is bring-your-own-key (BYOK)?",
    a: "You supply your own Claude or OpenAI API key. Qaera never pools or resells AI credits — your usage goes directly to your Anthropic or OpenAI account. Keys are encrypted at rest with AES-256-GCM.",
  },
  {
    q: "Can I switch between AI providers?",
    a: "Yes. You can configure any project to use Claude (Anthropic) or OpenAI-compatible models. The Team and Enterprise plans support per-project provider overrides.",
  },
  {
    q: "Is there a free trial for the Team plan?",
    a: "Team comes with a 14-day free trial — no credit card required. If you cancel before the trial ends, you won't be charged.",
  },
  {
    q: "What happens to my data if I cancel?",
    a: "You have 30 days after cancellation to export your test cases, plans, and reports. After that, data is deleted from our servers. You always own your tests.",
  },
  {
    q: "Do I need to set up my own infrastructure?",
    a: "No. The Starter and Team plans run tests on Qaera's managed infrastructure. Enterprise customers can optionally bring their own runners for tighter security controls.",
  },
];

type RowVal = string | boolean;

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mx-auto h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mx-auto h-4 w-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function CellValue({ val }: { val: RowVal }) {
  if (val === true) return <CheckIcon />;
  if (val === false) return <CrossIcon />;
  return <span className="text-sm text-slate-300">{val}</span>;
}

export function PricingClient() {
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
          Start free with your own Claude key. Scale when your team grows.
        </p>

        {/* Billing toggle */}
        <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] p-1">
          <button
            onClick={() => setAnnual(false)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              !annual ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              annual ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Annual
            <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-xs font-semibold text-emerald-400">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Tier cards */}
      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {TIERS.map((t) => {
          const price = annual && t.priceAnnual !== null ? t.priceAnnual : t.priceMonthly;
          const isNumeric = t.priceLabel !== "Free" && t.priceLabel !== "Custom";
          const displayPrice = t.priceLabel === "Free" ? "$0" : t.priceLabel === "Custom" ? "Custom" : `$${price}`;

          return (
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
              <div className="mt-4 flex items-end gap-2">
                <span className="text-4xl font-bold text-white">{displayPrice}</span>
                {isNumeric && price !== null && price > 0 && (
                  <div className="mb-1 flex flex-col items-start">
                    <span className="text-sm text-slate-400">/mo{annual ? " · billed annually" : ""}</span>
                    {annual && (
                      <span className="text-xs text-slate-500 line-through">${t.priceMonthly}/mo</span>
                    )}
                  </div>
                )}
              </div>
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
          );
        })}
      </div>

      {/* Comparison table */}
      <div className="mt-20">
        <h2 className="mb-8 text-center text-2xl font-bold text-white">Full feature comparison</h2>
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                <th className="p-4 text-left text-sm font-medium text-slate-400">Feature</th>
                {TIERS.map((t) => (
                  <th key={t.name} className="p-4 text-center text-sm font-semibold text-white">
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, i) => (
                <tr key={row.feature} className={`border-b border-white/5 ${i % 2 === 0 ? "" : "bg-white/[0.015]"}`}>
                  <td className="p-4 text-sm text-slate-300">{row.feature}</td>
                  <td className="p-4 text-center"><CellValue val={row.starter} /></td>
                  <td className="p-4 text-center"><CellValue val={row.team} /></td>
                  <td className="p-4 text-center"><CellValue val={row.enterprise} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-12 text-center">
        <p className="text-sm text-slate-400">
          All plans include bring-your-own-key support (Claude / OpenAI). No credit card required for Starter.
        </p>
      </div>

      {/* FAQ */}
      <div className="mt-20">
        <h2 className="mb-10 text-center text-2xl font-bold text-white">Frequently asked questions</h2>
        <div className="mx-auto max-w-3xl divide-y divide-white/10 rounded-2xl border border-white/10">
          {FAQ.map((item, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="flex w-full items-center justify-between px-6 py-5 text-left text-sm font-semibold text-white hover:bg-white/[0.03]"
              >
                {item.q}
                <svg
                  viewBox="0 0 24 24"
                  className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {openFaq === i && (
                <div className="px-6 pb-5 text-sm leading-relaxed text-slate-400">{item.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
