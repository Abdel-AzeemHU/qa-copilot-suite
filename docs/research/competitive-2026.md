# Competitive & Market Research — AI Test Automation (2026)

> Compiled June 2026 via multi-source web research. Each section notes source reliability.
> Feeds `docs/strategy.md`. Treat vendor marketing claims as unverified unless independently corroborated.

---

## A. Testsigma & ACCELQ

**Testsigma** — codeless NLP authoring (from stories, Figma, screenshots via "Copilot"); web + mobile (2,000+ real devices) + desktop + API; cloud SaaS (+ on-prem enterprise). Self-healing, autonomous "Atto" agents, built-in visual regression + WCAG checks. **Pricing: quote-only, both tiers require a sales call** — the most common complaint. Has a free **open-source Community Edition** (self-host, import/export) but advanced AI/parallel/reporting are cloud-only. Complaints: slow on large suites, flakiness in complex DOMs, weak reporting, opaque pricing.

**ACCELQ** — scenario/model-driven "Application Universe" blueprint; broadest backend coverage (web, API incl. Kafka/SOAP/MQ, ERP, mainframe, DB/ETL); codeless; cloud or on-prem (≥10 licenses). "Autopilot" + Discovery/Automation/Analyzer agents; autonomous element healing. **Quote-only** (one secondhand datapoint ~$2,256/license/yr, unverified); free-for-life manual tier. **Named Leader + only "Customer Favorite" in Forrester Wave: Autonomous Testing Platforms Q4 2025** (Jan 2026). Complaints: learning curve (the model paradigm), docs gaps, desktop automation, reporting. Stronger conceptual lock-in (proprietary model, no portable export found).

Sources: testsigma.com, accelq.com, bug0.com, g2.com, trustradius.com, businesswire (Forrester Wave).

---

## B. mabl / Functionize / testRigor / Katalon

| | Authoring | Mobile/API | Cheapest verifiable price | Lock-in |
|---|---|---|---|---|
| **mabl** | Low-code trainer + NLP | Mobile add-on / API yes | Custom (~$499/mo, secondhand) | Medium — exports to Playwright/Selenium (lossy snapshot) |
| **Functionize** | Codeless + plain English | **API & mobile gaps** | Custom (~$969/mo, secondhand) | **High** — proprietary cloud. Forrester Q4 2025 "Strong Performer." Near-zero independent reviews. |
| **testRigor** | Plain English (GenAI) | web/mobile/API/desktop | $0 free tier (paid = custom) | **High** — proprietary; free tier makes test cases **public/searchable** (privacy trap) |
| **Katalon** | No/low/full-code + StudioAssist (GPT) | Mobile (setup pain) / API | **$67/seat/mo verified** | **Low** — own the Groovy/TS code, self-host |

Common complaints across all: cost/opaque pricing, slow cloud execution, learning curve despite "codeless" marketing, performance degradation on large suites. Sources: vendor pages, g2.com, capterra, docketqa, getautonoma, momentic.

---

## C. Shift-left in 2025–2026

- Definition: move QA earlier (requirements/design/dev/CI) vs. post-deploy. Cost-of-defect rationale (~$1 design → ~$100 prod) is widely cited but **weakly sourced** (1990s IBM SSI, conflicting figures) — illustrative only.
- Practices: requirements/BDD testing; unit (70–80% coverage target); **CI tests <10 min**; shift-left security (SAST/SCA — Snyk: $1,400 CI vs $9,500 prod); **contract/API-first**; PR/pre-merge gates.
- **#1 barrier is cultural/role friction** (Forrester via contextqa), ahead of tooling. Then skills gaps, maintenance overhead, tooling complexity, slow-feedback fears.
- AI impact: **67% of QA teams now use ≥1 AI testing tool (up from 21% in 2024)** (qasphere); fintech example "23 tests in 45s from one Jira story"; ~60% faster test-case generation; 73% reduction in maintenance hrs w/ self-healing.
- **Self-healing resolves 70–90% of broken selectors, but selectors are only ~28% of failures** — healing alone is insufficient.
- Contract testing: 71% of orgs run 100+ internal APIs; schema drift is top-3 incident cause; PactFlow AI / SmartBear HaloAI (May 2025) generate Pact tests from OpenAPI. Playwright overtook Selenium (45.1% vs 22.1%).

Sources: contextqa, qasphere, totalshiftleft, docs.pact.io, testdino, playwright.dev.

---

## D. Moats & market structure

- **Hard moats (don't fight):** device grids (BrowserStack 30k+ devices / 21 DCs; Sauce ~20k), SOC2/ISO compliance, installed-base/integration depth (Tricentis 60%+ Fortune 500, ~$425M ARR, $4.5B valuation Nov 2024), mobile real-device infra, professional services.
- **Soft / commoditized (attack here):** test-authoring layer — eroded by Playwright (30M weekly npm downloads, 91% satisfaction) and LLM generation.
- **Open gaps:** quote-gated pricing excludes self-serve; transparent/usage pricing wedge (Qase, Kiwi TCMS); lock-in distrust (Tosca "rebuild all tests to switch", 15–20% renewal hikes); **BYO-LLM-key — no QA incumbent offers it** (but GitHub Copilot shipped BYOK Nov 2025).
- **Forrester** retired "Continuous Automation Testing" → created **Autonomous Testing Platforms** (Wave Q4 2025, 15 vendors; Leaders: UiPath, ACCELQ, Keysight; Applitools Strong Performer). "AI is nonnegotiable"; traditional tools plateau at ~25% automation.
- AI-native funding: Momentic (YC, $18.7M, customers Notion/Xero/Webflow); Thunders ($9M seed). Thesis: AI coding sped dev 5–10x but production incidents +43% YoY.

Sources: getautonoma, sacra, siliconangle, forrester.com, businesswire, uipath, codenote, kinde (BYOK).

---

## E. Portable code-gen, BYO-LLM, API & visual SOTA

- **Playwright v1.56 (Oct 2025)** shipped native **Planner / Generator / Healer** agents → plain `.spec.ts`, no proprietary runtime. "Vendor lock-in is lower than ever" (Qate, Jan 2026). → **Owning code is table stakes, not a moat.**
- Portable camp (emit `.spec.ts`): Qate, QA Wolf, OctoMind, Katalon. Proprietary engines: Testim, Reflect, Functionize, testRigor.
- **Dev trust data (Stack Overflow, Dec 2025):** 84% use/plan AI; only **29% trust output accuracy**, 46% distrust; #1 reason to ask a human = "when I don't trust AI" (75%); top frustration "almost right but not quite" (66%). AI-IDEs did NOT displace VS Code. → inspectable, human-in-the-loop wins.
- **BYO-LLM:** GitHub Copilot BYOK public preview Nov 20 2025 (Anthropic/OpenAI/xAI/Foundry); BYOK calls billed by provider. **Cursor's cautionary tale:** restricts BYOK from its best (Agent/Edit) features to protect margin + proprietary models. → Differentiate on orchestration/prompts/schemas, never token resale.
- **API gen:** Schemathesis (OpenAPI 2/3/3.1 + GraphQL, property-based; ICSE 2022: 1.4–4.5x more defects); Portman (OpenAPI→Postman contract tests); Pact (consumer-driven). Spec-driven = 95–100% endpoint coverage but **shallow on business-logic semantics** → LLM opening.
- **Visual/flakiness SOTA:** Applitools (visual AI, ignores dynamic content), Percy (~$199/mo), mabl (mature auto-heal), **Argos** (OSS-rooted, dedicated flaky-test scores). Frontier gap: **failure classification** (bug vs flake vs env) + environment normalization (DPI/scale-factor) still largely manual.

Sources: developer.microsoft.com, qate.ai, survey.stackoverflow.co, github.blog, apidog, schemathesis.io, totalshiftleft, argos-ci.com, browserstack.
