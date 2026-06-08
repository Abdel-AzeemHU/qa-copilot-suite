"use client";

import { useState } from "react";

type Priority = "High" | "Medium";

type GeneratedCase = {
  title: string;
  desc: string;
  priority: Priority;
  category: string;
  code: string;
};

type Scenario = {
  id: string;
  tab: string;
  story: string;
  criteria: string[];
  cases: GeneratedCase[];
};

const scenarios: Scenario[] = [
  {
    id: "ecom",
    tab: "E-commerce User Story",
    story:
      "As a returning shopper, I want to add items to my cart and apply a promo code at checkout so that I can purchase discounted products quickly.",
    criteria: [
      "Items can be added to the cart from the product page",
      "Cart subtotal updates as quantities change",
      "A valid promo code applies a discount before payment",
      "An invalid promo code shows a clear error message",
    ],
    cases: [
      {
        title: "Add item to cart updates subtotal",
        desc: "Adding a product increments the cart count and recalculates the subtotal correctly.",
        priority: "High",
        category: "Core Functionality",
        code: `test('add to cart updates subtotal', async ({ page }) => {\n  await page.goto('/products/widget');\n  await page.getByRole('button', { name: 'Add to cart' }).click();\n  await expect(page.getByTestId('cart-count')).toHaveText('1');\n  await expect(page.getByTestId('subtotal')).toContainText('$29.00');\n});`,
      },
      {
        title: "Valid promo code applies discount",
        desc: "Entering SAVE10 reduces the order total by 10% before payment is collected.",
        priority: "High",
        category: "Core Functionality",
        code: `test('valid promo applies discount', async ({ page }) => {\n  await page.goto('/checkout');\n  await page.getByLabel('Promo code').fill('SAVE10');\n  await page.getByRole('button', { name: 'Apply' }).click();\n  await expect(page.getByTestId('discount')).toContainText('-$2.90');\n});`,
      },
      {
        title: "Invalid promo code shows error",
        desc: "An unrecognized code surfaces a clear inline error and leaves the total unchanged.",
        priority: "Medium",
        category: "User Experience",
        code: `test('invalid promo shows error', async ({ page }) => {\n  await page.goto('/checkout');\n  await page.getByLabel('Promo code').fill('NOPE');\n  await page.getByRole('button', { name: 'Apply' }).click();\n  await expect(page.getByRole('alert')).toContainText('Invalid code');\n});`,
      },
      {
        title: "Quantity change recalculates cart",
        desc: "Increasing item quantity in the cart updates line totals and subtotal instantly.",
        priority: "Medium",
        category: "Core Functionality",
        code: `test('quantity change recalculates', async ({ page }) => {\n  await page.goto('/cart');\n  await page.getByLabel('Quantity').fill('3');\n  await expect(page.getByTestId('line-total')).toContainText('$87.00');\n});`,
      },
    ],
  },
  {
    id: "bank",
    tab: "Banking Login Flow",
    story:
      "As an account holder, I want to log in securely with multi-factor authentication so that my financial data stays protected from unauthorized access.",
    criteria: [
      "Login requires valid credentials plus a one-time passcode",
      "Five failed attempts lock the account temporarily",
      "Session expires after 10 minutes of inactivity",
      "Credentials are never exposed in URLs or logs",
    ],
    cases: [
      {
        title: "Successful MFA login",
        desc: "Valid credentials plus a correct OTP grant access to the account dashboard.",
        priority: "High",
        category: "Security",
        code: `test('successful MFA login', async ({ page }) => {\n  await page.goto('/login');\n  await page.getByLabel('Email').fill('user@bank.test');\n  await page.getByLabel('Password').fill('Sup3rSecret!');\n  await page.getByRole('button', { name: 'Continue' }).click();\n  await page.getByLabel('One-time code').fill('123456');\n  await expect(page).toHaveURL('/dashboard');\n});`,
      },
      {
        title: "Account locks after 5 failures",
        desc: "Five consecutive invalid passwords disable login and display a lockout notice.",
        priority: "High",
        category: "Security",
        code: `test('lockout after 5 failures', async ({ page }) => {\n  for (let i = 0; i < 5; i++) {\n    await page.getByLabel('Password').fill('wrong');\n    await page.getByRole('button', { name: 'Continue' }).click();\n  }\n  await expect(page.getByRole('alert')).toContainText('temporarily locked');\n});`,
      },
      {
        title: "Idle session expires",
        desc: "After 10 minutes of inactivity the user is signed out and redirected to login.",
        priority: "Medium",
        category: "Security",
        code: `test('idle session expires', async ({ page }) => {\n  await login(page);\n  await page.clock.fastForward('10:30');\n  await page.reload();\n  await expect(page).toHaveURL('/login');\n});`,
      },
      {
        title: "Credentials never appear in URL",
        desc: "Password and OTP are submitted via POST body and never leak into query params.",
        priority: "Medium",
        category: "Security",
        code: `test('no credentials in url', async ({ page }) => {\n  await login(page);\n  expect(page.url()).not.toContain('password');\n  expect(page.url()).not.toContain('otp');\n});`,
      },
    ],
  },
  {
    id: "health",
    tab: "Healthcare Appointment Booking",
    story:
      "As a patient, I want to book an appointment with an available provider so that I can receive care at a time that works for my schedule.",
    criteria: [
      "Only available time slots can be selected",
      "Double-booking the same slot is prevented",
      "Booking confirmation is sent to the patient",
      "Past dates cannot be selected",
    ],
    cases: [
      {
        title: "Book an available slot",
        desc: "A patient selects an open slot and receives an on-screen booking confirmation.",
        priority: "High",
        category: "Core Functionality",
        code: `test('book available slot', async ({ page }) => {\n  await page.goto('/book/dr-rivera');\n  await page.getByRole('button', { name: '10:30 AM' }).click();\n  await page.getByRole('button', { name: 'Confirm booking' }).click();\n  await expect(page.getByText('Appointment confirmed')).toBeVisible();\n});`,
      },
      {
        title: "Prevent double-booking",
        desc: "An already-reserved slot is disabled and cannot be selected by a second patient.",
        priority: "High",
        category: "Core Functionality",
        code: `test('prevent double booking', async ({ page }) => {\n  await page.goto('/book/dr-rivera');\n  await expect(page.getByRole('button', { name: '09:00 AM' }))\n    .toBeDisabled();\n});`,
      },
      {
        title: "Confirmation is delivered",
        desc: "After booking, a confirmation notification is generated for the patient record.",
        priority: "Medium",
        category: "User Experience",
        code: `test('confirmation delivered', async ({ page, request }) => {\n  await bookSlot(page);\n  const res = await request.get('/api/notifications/latest');\n  expect(await res.json()).toMatchObject({ type: 'booking_confirmed' });\n});`,
      },
      {
        title: "Past dates are blocked",
        desc: "Calendar dates before today are disabled and rejected by the booking form.",
        priority: "Medium",
        category: "User Experience",
        code: `test('past dates blocked', async ({ page }) => {\n  await page.goto('/book/dr-rivera');\n  await expect(page.getByLabel('Yesterday')).toBeDisabled();\n});`,
      },
    ],
  },
];

const priorityStyles: Record<Priority, string> = {
  High: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Medium: "bg-blue-500/15 text-blue-300 border-blue-500/30",
};

export function LiveDemo() {
  const [active, setActive] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [openCase, setOpenCase] = useState<number | null>(null);
  const scenario = scenarios[active];

  function selectTab(i: number) {
    setActive(i);
    setStatus("idle");
    setOpenCase(null);
  }

  function generate() {
    setStatus("loading");
    setOpenCase(null);
    setTimeout(() => setStatus("done"), 1500);
  }

  function reset() {
    setStatus("idle");
    setOpenCase(null);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
        {scenarios.map((s, i) => (
          <button
            key={s.id}
            onClick={() => selectTab(i)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
              active === i
                ? "border-transparent bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400 text-white shadow-lg shadow-indigo-500/25"
                : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]"
            }`}
          >
            {s.tab}
          </button>
        ))}
        <button
          onClick={reset}
          className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-slate-400 transition-colors hover:text-white"
        >
          Reset Demo
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* LEFT: light input card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-indigo-100 text-indigo-600">
              1
            </span>
            User Story Input
          </div>
          <p className="text-[15px] leading-relaxed text-slate-700">
            {scenario.story}
          </p>
          <div className="mt-5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Acceptance Criteria
            </h4>
            <ul className="mt-3 space-y-2">
              {scenario.criteria.map((c) => (
                <li key={c} className="flex items-start gap-2 text-sm text-slate-700">
                  <svg
                    viewBox="0 0 24 24"
                    className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <button
            onClick={generate}
            disabled={status === "loading"}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-400 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition-transform hover:scale-[1.01] disabled:opacity-60"
          >
            {status === "loading" ? "Generating…" : "✨ Generate Test Cases with AI →"}
          </button>
        </div>

        {/* RIGHT: dark output card */}
        <div className="rounded-2xl border border-white/10 bg-[#0d0e1a] p-6 shadow-xl">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-400">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-emerald-500/15 text-emerald-400">
              2
            </span>
            Generated Test Suite
          </div>

          {status === "idle" && (
            <div className="flex h-72 flex-col items-center justify-center text-center text-slate-500">
              <svg viewBox="0 0 24 24" className="mb-3 h-10 w-10 text-slate-600" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="m18 16 4-4-4-4M6 8l-4 4 4 4M14.5 4l-5 16" />
              </svg>
              <p className="text-sm font-medium text-slate-400">Ready to Generate</p>
              <p className="mt-1 text-xs text-slate-500">
                Hit generate to turn this story into a verified test suite.
              </p>
            </div>
          )}

          {status === "loading" && (
            <div className="flex h-72 flex-col items-center justify-center text-center">
              <div className="flex gap-1.5">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="h-2.5 w-2.5 animate-bounce rounded-full bg-gradient-to-r from-indigo-400 to-emerald-400"
                    style={{ animationDelay: `${d * 0.15}s` }}
                  />
                ))}
              </div>
              <p className="mt-4 text-sm text-slate-400">
                Claude is analyzing the story and drafting test cases…
              </p>
            </div>
          )}

          {status === "done" && (
            <div className="space-y-3">
              {scenario.cases.map((c, i) => (
                <div
                  key={c.title}
                  className="mk-fade-up cursor-pointer rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/20 hover:bg-white/[0.06]"
                  style={{ animationDelay: `${i * 0.12}s` }}
                  onClick={() => setOpenCase(openCase === i ? null : i)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h5 className="text-sm font-semibold text-white">{c.title}</h5>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${priorityStyles[c.priority]}`}
                    >
                      {c.priority}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                    {c.desc}
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
                      {c.category}
                    </span>
                  </div>
                  {openCase === i && (
                    <pre className="mk-fade-up mt-3 overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-3 text-[11px] leading-relaxed text-emerald-200">
                      <code>{c.code}</code>
                    </pre>
                  )}
                </div>
              ))}
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-xs text-emerald-300">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="m9 18 6-6-6-6" />
                </svg>
                Click any test case to convert it to automated code.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
