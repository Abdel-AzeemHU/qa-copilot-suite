const testimonials = [
  {
    quote: "We cut our manual test writing time by 80% in the first sprint. The self-healing alone saved us hours of Playwright maintenance every release.",
    author: "Priya Nair",
    role: "Senior QA Engineer",
    company: "FinTech startup (Series B)",
  },
  {
    quote: "The closed-loop approach is genuinely different. We went from requirements to a passing Playwright suite in under two hours — including bug reports filed to Jira.",
    author: "Marcus Webb",
    role: "Head of Engineering",
    company: "SaaS platform, 50-person team",
  },
  {
    quote: "I was skeptical of AI-generated tests until the traceability spine showed me exactly which requirements were uncovered. It found three gaps our team had missed for months.",
    author: "Sofia Okonkwo",
    role: "VP of Product Quality",
    company: "Enterprise software vendor",
  },
];

const LOGOS = [
  "Vercel",
  "Stripe",
  "Notion",
  "Linear",
  "Supabase",
];

export function SocialProof() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        {/* Logos */}
        <p className="mb-8 text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Trusted by teams at
        </p>
        <div className="mb-16 flex flex-wrap items-center justify-center gap-8">
          {LOGOS.map((name) => (
            <span
              key={name}
              className="text-lg font-bold tracking-tight text-slate-500 opacity-60 transition-opacity hover:opacity-90"
            >
              {name}
            </span>
          ))}
        </div>

        {/* Testimonials */}
        <div className="grid gap-5 sm:grid-cols-3">
          {testimonials.map((t) => (
            <div
              key={t.author}
              className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-indigo-400 opacity-60" fill="currentColor">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
              </svg>
              <p className="flex-1 text-sm leading-relaxed text-slate-300">{t.quote}</p>
              <div>
                <p className="text-sm font-semibold text-white">{t.author}</p>
                <p className="text-xs text-slate-500">{t.role} · {t.company}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-slate-600">
          * Illustrative examples — not real customer endorsements.
        </p>
      </div>
    </section>
  );
}
