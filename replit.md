# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## UniVerse — Smart University (Agriculture College)

Single product spanning the API server and the `universe` web artifact. Bilingual Arabic-first (RTL) + English. Free tier; demo role-switcher (no real auth, cookie `uv_demo_user`, default user 1).

### Artifacts

- `artifacts/api-server` (Express, mounted at `/api`) — Drizzle + Postgres + zod, AI via Replit Gemini integration (`@google/genai` SDK).
- `artifacts/universe` (React + Vite, root `/`) — Tailwind, wouter, TanStack Query, generated orval hooks, zustand for language store. Agriculture palette (cream, deep green, terracotta, gold). No emojis.

### Pages

Public: home (animated hero), news, staff, dashboard (group badge + stats), courses, quizzes, forum (group filter), talents (Instagram-style: likes/comments/share), skills, leaderboard, complaints, games (3 mini-games + leaderboard), AI coach, login (email + phone verification, codes `123456`/`654321`).

Admin: `/admin` hub with module cards → `/admin/news`, `/admin/staff`, `/admin/users`, `/admin/talents` (moderation w/ custom warnings), `/admin/proposals` (super-admin approval queue).

### Data (seeded)

24 students split across **groups A–E**, 10 staff (incl. user 9 = `admin` Fatma, user 10 = `super_admin` Khaled), 6 news, courses w/ materials (lecturer + pdfUrl), quizzes, forum, talents (with `status` + likes/comments), skills, missions, complaints, schedule/grades/attendance, notifications, game scores.

### Schema (`lib/db/src/schema/`)

users (+ `groupName` A–E, `phone`, `phoneVerified`, `verified`), news, courses (+materials with `lecturer`/`pdfUrl`), quizzes (+ `groupOnly`, +questions), forum_posts (+ `groupOnly`, +replies), talents (+ `status` active/removed, +`groupOnly`, +`talentLikes`, +`talentComments`), skills (+lessons), missions, complaints, **adminProposals** (action/resourceKind/payload/status/decisionNote), **gameScores**, notifications.

### Roles & approval workflow

`student` / `doctor` / `ta` / `admin` / `super_admin`. Admin proposes any create/update/delete or `remove_talent` via `POST /api/v2/admin/proposals` → super_admin approves/rejects via `/api/v2/admin/proposals/:id/decide`, which calls `applyProposal()` to mutate the underlying entity and dispatches notifications back to the proposer. Super_admin proposals auto-apply.

### v2 API surface (raw, no codegen — see `routes/v2.ts`)

`/v2/me`, `/v2/notifications` (+ unreadCount), `/v2/auth/start` + `/v2/auth/verify`, `/v2/talents` + `/v2/talents-feed` + `/v2/talents/:id/like` + `/v2/talents/:id/comments`, `/v2/admin/talents`, `/v2/admin/staff`, `/v2/admin/proposals` (list+create+decide), `/v2/games/score` + `/v2/games/leaderboard`. Frontend hits these via raw-fetch helper `lib/api.ts` (no orval).

### AI

Gemini integration provisioned via `setupReplitAIIntegrations` (env vars `AI_INTEGRATIONS_GEMINI_BASE_URL`/`API_KEY`). Client in `artifacts/api-server/src/lib/ai.ts` — **must use `httpOptions: { baseUrl, apiVersion: "" }`** (the Replit proxy rejects both `v1` and `v1beta` paths). Model `gemini-2.5-flash`.

### Notes / gotchas

- After schema edits, run `pnpm run typecheck:libs` so `lib/db/dist` exports update before the api-server restarts.
- `lib/api-zod/src/index.ts` is hand-edited to a single line; orval clean overwrites it on every codegen so leave the zod block free of TS schemas.
- Seed: `pnpm exec tsx artifacts/api-server/src/seed.ts`.
- Reset DB then reseed if schema changes break data.

### Run / smoke test

- API: `https://$REPLIT_DEV_DOMAIN/api/healthz`, `/api/me`, `/api/home/feed`, `/api/dashboard`, `/api/ai/chat` (POST).
- Web: home `/`, dashboard `/dashboard`, admin `/admin` — all render polished Arabic RTL pages with no console errors.
