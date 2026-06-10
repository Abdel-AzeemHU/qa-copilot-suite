# QA Copilot Suite — Product Strategy

> Status: living document. Last updated 2026-06-10.
> Grounded in competitive + market research (see `docs/research/competitive-2026.md` for sources).

---

## 1. The uncomfortable truth (read this first)

We cannot win by being "Testsigma/ACCELQ but cheaper." Three findings from the research reset the plan:

1. **Code generation is commoditized.** Playwright v1.56 (Oct 2025) ships its own AI **Planner → Generator → Healer** agents, free, emitting plain `.spec.ts`. "Emit portable code you own" is now **table stakes Microsoft gives away** — not a moat. (Qate AI, Jan 2026; MS Dev blog.)
2. **The incumbents' real moats are physical/regulatory, not the authoring layer.** BrowserStack runs 30,000+ real devices across 21 data centers; Tricentis is in 60%+ of the Fortune 500; SOC2/ISO gate regulated deals. We will not out-capital these. (sacra.com, siliconangle, bug0.)
3. **Developers distrust black-box AI.** Only **29% trust AI output**; 66% are frustrated by answers "almost right but not quite"; subscription AI-IDEs did *not* displace VS Code. (Stack Overflow Survey, Dec 2025.) → Our surface must be **inspectable and human-in-the-loop**, not autonomous magic.

**Conclusion:** The authoring layer is a race to zero. We must compete one level up — on the **integrated shift-left loop**, **flakiness/reliability intelligence that compounds over time**, and a **team surface non-technical members can actually use**. That is where both Playwright-the-library and the quote-gated enterprise suites are weak.

---

## 2. Where the market is actually open

| Gap (evidence) | Our wedge |
|---|---|
| **Quote-gated pricing** excludes self-serve / small teams. Testsigma, ACCELQ, mabl, Tricentis are all "talk to sales." (bug0, docketqa) | Transparent, self-serve, **BYO-LLM-key** pricing. |
| **No incumbent offers BYO-LLM-key.** GitHub shipped Copilot BYOK Nov 2025 — model is now enterprise-validated. (github.blog) | We already store user Claude/OpenAI keys encrypted. Lean in. |
| **Self-healing fixes only ~28% of failures** (selectors); the rest are timing/env/data/real bugs. (qasphere) | Go beyond selector healing → **failure *classification*** (bug vs flake vs env vs automation). |
| **Flakiness classification is the frontier** — env normalization still manual. (BrowserStack, shakacode) | Make flakiness intelligence our **signature**, compounding per-project over time. |
| **Spec-driven API gen is strong on coverage, shallow on semantics.** (totalshiftleft) | LLM **business-logic-aware** API tests on top of structural coverage. |
| **Shift-left's #1 barrier is cultural/role friction**, not tooling. (Forrester via contextqa) | A surface where **PM/BA/non-technical** members contribute, lowering the social barrier. |

---

## 3. Positioning statement

> **QA Copilot Suite is the AI-native, developer-trusted QA copilot that takes a team from a plain-English requirement to a running, self-healing, flake-resistant test suite — with code you own and an LLM key you control.**
>
> Built for fast-moving product teams (5–200 people) that find Testsigma/ACCELQ too expensive and opaque, and raw Playwright too developer-only.

**ICP (who we win first):** Engineering-led startups & scaleups with a small/embedded QA function, a PM/BA who wants to contribute to quality, and a CI pipeline they already trust. They value: self-serve, no lock-in, transparent cost, fast feedback.

**Who we deliberately do NOT chase yet:** Fortune-500 regulated enterprises (SOC2/device-grid/professional-services moats too deep), and pure mobile-first shops (device-farm capital).

---

## 4. The three pillars we will be undeniably best at

Everything else is supporting cast. Be the best in the world at these three:

### Pillar 1 — The shift-left loop (requirement → owned test → CI gate)
The seamless path is the demo: English requirement → AI test case → owned Playwright-TS / REST-Assured-Java → run in CI → block the merge. Incumbents fragment this; Playwright-the-library only covers the middle. We own the **whole arc**, including the non-technical front door.

### Pillar 2 — Reliability intelligence (the compounding moat)
This is the one thing that gets *better the longer a team uses us* — a genuine data flywheel incumbents can't copy by buying hardware:
- Failure **classification**: real bug vs flake vs environment vs automation error (not just "self-heal the selector").
- Flakiness **trends over time** per test, auto-quarantine in CI, "maintenance hours saved" dashboard.
- Healing cascade (we already have Layer 1 + Layer 2) feeding a per-project selector/intent memory.

### Pillar 3 — API-first / contract testing for the microservices era
71% of orgs now run 100+ internal APIs; schema drift is a top-3 incident cause. (WQR 2025 via totalshiftleft.) We already import OpenAPI/Postman → test cases. Extend to **contract testing** (catch spec-vs-code drift pre-merge) where we have a semantics edge over pure fuzzers.

---

## 5. What to build vs. deliberately skip

**Build (next 2 quarters), in priority order:**
1. **CI merge-gate as a first-class product** — PR check that blocks on failures + flakiness threshold + coverage drop. This operationalizes shift-left and is where the value is felt. (We have the CI trigger + GitHub Action; make the *gate* the hero.)
2. **Failure classification engine** — extend self-healer to label every failure (bug/flake/env/automation). Feeds Pillar 2.
3. **Flakiness intelligence v2** — historical trends, auto-quarantine, value dashboard (we shipped v1).
4. **Contract testing** from OpenAPI (spec-vs-code drift), building on the API testing we shipped.
5. **Requirement-stage front door for non-technical users** — Jira/story → test cases in one click (lowers the cultural barrier; aligns with the fintech "23 tests in 45s" data point).

**Skip / partner / defer (do NOT sink scarce effort here):**
- ❌ **Own device grid / mobile real-device farm** — capital moat; integrate BrowserStack/Sauce later instead.
- ❌ **Competing on raw code-gen quality vs. Playwright's native agents** — match "good enough," differentiate above it.
- ⏸ **SOC2 / SSO / SAML** — necessary for up-market, but *after* product-market fit with the ICP. (We have orgs/roles/audit scaffolding ready.)
- ⏸ **Autonomous "no human" testing** — the trust data says human-in-the-loop wins now; revisit as models improve.

---

## 6. Pricing model

Anchor on the gaps: transparent + self-serve + BYO-LLM.
- **Free / OSS-ish tier:** self-host, BYO-LLM-key, core generation + run. (Mirrors testRigor/Testsigma CE pulling in the bottom of market — but *without* their public-test-case privacy trap.)
- **Team (self-serve, published price):** hosted runs, flakiness intelligence, CI gate, integrations. Beat the "$167/seat Katalon / ~$499/mo mabl" band on transparency, not necessarily on raw price.
- **Enterprise (later):** SSO, on-prem, compliance — only once ICP traction exists.
- **The margin discipline (Cursor's lesson):** our value must live in **orchestration, prompts, schemas, and the reliability flywheel** — never in reselling tokens. BYOK is the trust feature; the product is everything around it.

---

## 7. The 12-month narrative arc

1. **Q1 — Nail the loop.** Requirement → owned test → CI merge-gate, end to end, self-serve, BYO-key. One killer demo.
2. **Q2 — Reliability moat.** Failure classification + flakiness v2 + "maintenance saved" dashboard. This is the retention engine.
3. **Q3 — API/contract depth.** Spec-vs-code drift detection; become the obvious choice for microservices teams.
4. **Q4 — Earn the up-market option.** SSO + compliance scaffolding; land 2–3 lighthouse scaleups; measure "% of merges gated" and "flaky tests quarantined" as our north-star metrics.

**North-star metric:** not tests generated (vanity) but **% of a team's merges protected by our gate** × **maintenance hours saved** — the two things that prove we shifted quality left *and* made it stick.

---

## 8. Honest risk register

- **Playwright's native agents improve fast** → our value must keep climbing the stack (loop + reliability + team surface), never sit on code-gen.
- **An incumbent ships BYO-LLM + transparent pricing** → possible but culturally hard for sales-led orgs; speed is our advantage.
- **Reliability flywheel needs data** → cold-start problem; seed with strong heuristics (we have the healer/classifier) before the data compounds.
- **Trust in AI output is low (29%)** → keep everything inspectable, diff-based, human-approvable; never hide what the AI did.
