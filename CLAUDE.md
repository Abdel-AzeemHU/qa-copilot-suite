@AGENTS.md

# QA Copilot Suite

AI-assisted QA platform. Phase 1: email/password auth, projects, and an
LLM-powered Test Case Generator with CSV/Gherkin export.

## Docs

- Plan & strategy: `docs/plan-and-strategy.md`
- Environment variables: `.env.local.example`

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript (strict) + Tailwind 4
- Auth: NextAuth.js v5 (credentials) + Prisma adapter
- DB: Prisma 7 + SQLite (driver adapter `@prisma/adapter-better-sqlite3`)
- AI: Anthropic SDK (`claude-opus-4-8`), structured output via tool use

## Layout

- `app/` — App Router pages, server actions (`app/actions.ts`), route handlers
- `components/ui/` — shadcn-style UI primitives
- `lib/ai/` — `LLMProvider` interface, Claude adapter, `runHelper`
- `lib/helpers/` — AI helpers (e.g. `test-case-generator.ts`: prompt + Zod schemas)
- `lib/db/prisma.ts` — Prisma client singleton
- `lib/crypto.ts` — AES-256-GCM for encrypting user API keys at rest
- `prisma/schema.prisma` — data models
- `tests/smoke/` — Vitest smoke tests

## Commands

- `npm run dev` — dev server
- `npm run build` — production build (type-checks)
- `npm test` — run Vitest
- `npx prisma generate && npx prisma db push` — sync the DB

## Conventions

- Data mutations go through Server Actions, not a separate API layer.
- All AI structured output is obtained via Claude tool use + validated with Zod.
- Never hardcode API keys; users supply their Claude key via the UI (stored encrypted).
