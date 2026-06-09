import Link from "next/link";
import { Logo } from "./logo";

const cols = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/features#workflow-demo", label: "How it works" },
      { href: "/register", label: "Get Started" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/about", label: "Blog" },
      { href: "/about", label: "Careers" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms of Service" },
      { href: "/about", label: "Security" },
    ],
  },
  {
    title: "Connect",
    links: [
      { href: "https://github.com", label: "GitHub" },
      { href: "https://twitter.com", label: "Twitter / X" },
      { href: "https://discord.com", label: "Discord" },
      { href: "/about", label: "Contact" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#0a0b14]">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          <Logo />
          <p className="mt-4 text-sm font-medium text-emerald-400">
            Close the loop on QA.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            The AI QA suite that generates test cases, writes automation, runs
            it live, heals what breaks, and traces it all back to the
            requirement.
          </p>
        </div>

        {cols.map((c) => (
          <div key={c.title}>
            <h4 className="text-sm font-semibold text-white">{c.title}</h4>
            <ul className="mt-4 space-y-3">
              {c.links.map((l, i) => (
                <li key={i}>
                  <Link
                    href={l.href}
                    className="text-sm text-slate-400 transition-colors hover:text-white"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-5 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:px-8">
          <span>© 2026 QA Copilot Suite. All rights reserved.</span>
          <span className="text-xs text-slate-600">
            Illustrative product — in open beta.
          </span>
        </div>
      </div>
    </footer>
  );
}
