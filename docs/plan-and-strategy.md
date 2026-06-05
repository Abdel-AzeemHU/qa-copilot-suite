# QA Copilot Suite — Plan & Strategy

## 1. Vision

QA Copilot Suite is an AI-assisted quality-engineering platform. It helps teams
turn requirements into structured, reviewable, exportable test artifacts and —
over later phases — execute and report on them. Phase 1 delivers the foundation:
authentication, organizations/projects, and the first AI helper (the Test Case
Generator), with CSV and Gherkin export.

## 2. Goals & Non-Goals (Phase 1)

**Goals**

- Email/password authentication.
- Organizations → Projects → Test Cases data model.
- An LLM abstraction (`LLMProvider`) with a Claude adapter.
- A reusable AiHelper pattern (`runHelper`) for structured LLM tasks.
- A Test Case Generator helper that produces validated structured JSON.
- App Router UI for auth, dashboard, projects, generation, and editing.
- Export to CSV and Gherkin.
- A smoke test validating the generator against its output schema.

**Non-Goals (Phase 1)**

- Test execution, scheduling, or CI integration.
- Multi-user orgs, roles, or invitations (one implicit org per user).
- Multiple LLM providers beyond the Claude adapter scaffold.
- Billing, analytics, and notifications.

## 3. Architecture Overview

- **Next.js 15 App Router** for both UI (Server Components) and mutations
  (Server Actions). No separate REST/GraphQL layer in Phase 1.
- **NextAuth.js v5** with the Prisma adapter and a JWT session strategy
  (required for the credentials provider).
- **Prisma 7 + SQLite** via a driver adapter for local-dev simplicity; the same
  Prisma API ports to Postgres later by swapping the adapter and provider.
- **AI layer** lives in `lib/ai/` and `lib/helpers/`, decoupled from the UI so
  helpers can be unit-tested with a mock provider.

## 4. Data Model

- **User** — id, email, passwordHash, name, createdAt.
- **Organization** — id, name, ownerId → User, createdAt.
- **Project** — id, name, description, orgId → Organization, createdAt.
- **TestCase** — id, projectId → Project, title, preconditions, steps (JSON
  string), expectedResult, priority, type, requirement, targetUrl, timestamps.
- **ApiKey** — id, userId → User, provider, encryptedKey, createdAt.
- NextAuth adapter models: Account, Session, VerificationToken.

Steps are stored as a JSON-encoded string array (SQLite has no native JSON
array column); the app encodes/decodes at the boundary.

## 5. AI Layer Design

- **`LLMProvider`** — a minimal interface: `generateStructured(req)` takes a
  system prompt, a user message, and a single output tool spec, and returns the
  raw structured object the model produced.
- **Claude adapter** — uses `client.messages.create` with `tools` and
  `tool_choice: { type: "tool", name }` to force structured tool output
  (`claude-opus-4-8`). It extracts the `tool_use` block's `input`.
- **AiHelper + `runHelper`** — an `AiHelper` bundles a system prompt, Zod input
  and output schemas, a tool spec, and a `buildUserMessage` function.
  `runHelper` validates input, calls the provider, and validates output. This
  keeps prompt/schema logic colocated and independently testable.

## 6. Test Case Generator

- System prompt instructs Claude to act as a senior QA engineer and always
  respond via the `record_test_cases` tool.
- Output schema:
  `{ cases: Array<{ title, preconditions, steps: string[], expectedResult,
  priority: "high"|"medium"|"low",
  type: "functional"|"edge"|"negative"|"performance"|"security" }> }`.
- Input: a requirement (required), optional target URL, optional count.
- Generated cases are persisted to the project's TestCase rows.

## 7. Security

- User Claude API keys are encrypted at rest with AES-256-GCM. The key is
  derived (scrypt) from `ENCRYPTION_KEY`, a server-only secret.
- API keys are never hardcoded, logged, or returned to the client in plaintext.
- All data access is scoped to the authenticated user's organizations.
- Passwords are hashed with bcrypt.

## 8. UI / Routes

- `/` → redirect to `/dashboard` (logged in) or `/login`.
- `/login`, `/register` — credential auth forms.
- `/dashboard` — list projects.
- `/projects/new` — create a project.
- `/projects/[id]` — project detail: test-case table, generator link, exports.
- `/projects/[id]/generate` — generator form (requirement, URL, API key).
- `/projects/[id]/test-cases/[tcId]` — view and edit a test case.
- `/projects/[id]/export/[format]` — CSV / Gherkin download route handler.

UI is built with shadcn-style primitives (button, input, textarea, card, table,
badge, label) on Tailwind 4.

## 9. Export Formats

- **CSV** — one row per test case with title, type, priority, preconditions,
  pipe-joined steps, expected result, and requirement; RFC-4180-style escaping.
- **Gherkin** — a `.feature` file: one `Scenario` per test case, with
  `Given` (preconditions), `When`/`And` (steps), and `Then` (expected result),
  annotated with priority/type comments.

## 10. Testing Strategy

- **Smoke tests** (Vitest) validate the Test Case Generator end-to-end with a
  mock `LLMProvider`: input validation, output schema conformance, rejection of
  bad input, rejection of schema-violating output, and the Claude adapter's
  tool-use extraction path (with a mocked Anthropic client).
- Later phases add integration tests for actions and component tests for the UI.

## 11. Future Phases (preview)

- Additional AI helpers (bug triage, test-data generation, coverage analysis).
- Multiple providers behind `LLMProvider` (OpenAI adapter scaffolded in schema).
- Team orgs with roles and invitations; Postgres in production.
- Test execution, run history, and reporting.
