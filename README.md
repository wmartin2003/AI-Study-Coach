# AI Study Coach

AI Study Coach turns a student's course material into a focused daily plan, guided AI tutoring, adaptive quizzes, a calendar of deadlines, and progress tracking toward course completion.

This project was originally scaffolded on Replit but runs entirely on standard tooling — Node.js, pnpm, Supabase, and the Anthropic API. Nothing here requires Replit to develop, build, or deploy.

## Stack

- **Monorepo**: pnpm workspaces, Node.js 24, TypeScript 5.9
- **Frontend** (`artifacts/study-coach`): React 19, Vite 7, wouter (routing), Tailwind CSS 4, shadcn/ui + Radix, TanStack React Query
- **Backend** (`artifacts/api-server`): Express 5, running as a single Node process
- **Database, Auth, Storage**: [Supabase](https://supabase.com) — Postgres with Row Level Security, Supabase Auth (email/password), Supabase Storage for uploaded documents
- **AI**: [Anthropic API](https://console.anthropic.com) (`@anthropic-ai/sdk`), model `claude-sonnet-5`
- **API contract**: `lib/api-spec/openapi.yaml` is the source of truth; [Orval](https://orval.dev) generates Zod schemas (`lib/api-zod`) and React Query hooks (`lib/api-client-react`) from it

## Prerequisites

- Node.js 24+
- pnpm 10 (the repo enforces pnpm — `npm install` / `yarn install` will refuse to run)
- A [Supabase](https://supabase.com) project (free tier is fine)
- An [Anthropic API key](https://console.anthropic.com/settings/keys)

## 1. Set up Supabase

1. Create a new project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Apply the schema by running every SQL file in `supabase/migrations/` **in order** against your project — either paste each file's contents into the Supabase SQL Editor one at a time, or run them all with `psql`:
   ```bash
   for f in supabase/migrations/*.sql; do psql "$SUPABASE_DB_URL" -f "$f" || break; done
   ```
   This creates every table, enables Row Level Security on all of them, sets up the storage buckets used for uploaded documents, installs the trigger that provisions a profile row on signup, and locks down the invite-code functions to the service role. Every file is written to be safe to re-run, so the same command is what you run to apply new migrations later too (locally or against production — see "Deployment" below).
3. From your project's **Settings → API** page, collect the values you'll need below: the project URL, the publishable (anon) key, and the secret (service role) key.
4. From **Settings → Database**, collect the connection string for `SUPABASE_DB_URL` (used for running migrations and any admin scripts — never used by the running app itself).

## 2. Configure environment variables

Copy the example files and fill in real values:

```bash
cp .env.example .env
cp artifacts/study-coach/.env.example artifacts/study-coach/.env
```

`.env` (repo root, used by the API server):

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/settings/keys) |
| `SUPABASE_URL` | Supabase → Settings → API |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API (anon/publishable key) |
| `SUPABASE_SECRET_KEY` | Supabase → Settings → API (service role key — **server-side only, never expose to the frontend**) |
| `SUPABASE_DB_URL` | Supabase → Settings → Database (used for running migrations, not by the app at runtime) |
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same as `SUPABASE_PUBLISHABLE_KEY` |
| `ALLOWED_ORIGINS` | Comma-separated list of origins allowed to call the API in production (e.g. `https://app.example.com`). Falls back to `localhost` in development. |
| `USER_MONTHLY_BUDGET_USD` | Optional. Default per-user monthly AI spend cap in USD (default **$1.00** if unset); a student's `profiles.monthly_budget_usd`, when set, overrides this for that student. |
| `SIGNUP_REQUIRE_INVITE` | Optional, default `false`. See "Spend and signup caps" below. |
| `MAX_ACCOUNTS` | Optional, default `40`. See "Spend and signup caps" below. |

`artifacts/study-coach/.env` only needs the two `VITE_*` values (Vite only exposes env vars prefixed `VITE_` to the frontend bundle — this is what keeps the secret key out of the browser).

Never commit `.env` files — they're already gitignored.

### Spend and signup caps

Three independent ceilings, checked in this order on every AI call and on every signup:

1. **`ai_service_state.monthly_budget_usd`** (default **$35/month**, a database row, not an env var) — a global kill switch. Once this month's total spend across every student reaches it, every AI call in the app returns 503 until next month (or until you raise it). Change it directly in Supabase (`update ai_service_state set monthly_budget_usd = 50 where id = 1;`) or flip `ai_service_state.paused = true` to stop AI calls immediately regardless of spend.
2. **`USER_MONTHLY_BUDGET_USD`** (default **$1.00/month**, env var) — the default per-student cap. A student who hits it gets a 429 with a clear message; everything else in the app keeps working.
3. **`MAX_ACCOUNTS`** (default **40**, env var) — a hard ceiling on total accounts. `POST /api/signup` returns 503 once `profiles` has this many rows.

**To raise a specific student's cap** (e.g. they're doing something that legitimately needs more room), set it on their profile row rather than raising the global default:

```sql
update profiles set monthly_budget_usd = 5 where id = '<their user id>';
```

**To open or close signup entirely**, set `SIGNUP_REQUIRE_INVITE=true` on the API host and redeploy — invite codes (`pnpm --filter @workspace/scripts run invites -- generate`) become required again immediately, with no code changes. The `invite_codes` table and redemption path are always intact; this env var is the only thing that decides whether they're enforced.

## 3. Install dependencies

```bash
pnpm install
```

## 4. Run in development

Two processes run side by side. The frontend dev server proxies `/api/*` requests to the backend, so start the backend first.

**Terminal 1 — API server** (`artifacts/api-server`):
```bash
PORT=5050 NODE_ENV=development pnpm --filter @workspace/api-server run dev
```

**Terminal 2 — frontend** (`artifacts/study-coach`):
```bash
PORT=5174 BASE_PATH=/ API_PORT=5050 pnpm --filter @workspace/study-coach run dev
```

Open http://localhost:5174.

(`PORT` and `BASE_PATH` are required by `vite.config.ts`; `API_PORT` tells the dev server's proxy which port the API is on. Adjust the numbers if those ports are taken — just keep `API_PORT` matching whatever `PORT` you gave the API server.)

## 5. Build for production

```bash
pnpm run typecheck   # full workspace typecheck
PORT=5174 BASE_PATH=/ pnpm run build   # typecheck + build every package
```

This produces `artifacts/api-server/dist/index.mjs` (run with `node artifacts/api-server/dist/index.mjs`, with `PORT` and the `.env` variables set in the environment) and `artifacts/study-coach/dist/public/` (a static asset bundle — serve it with any static file host, with SPA fallback routing to `index.html` so client-side routes like `/course` or `/tutor` work on a hard refresh).

## Deployment

The frontend and API are deployed as two separate hosts, fed from this GitHub repo:

- **Frontend → Vercel**, building `artifacts/study-coach` per `vercel.json` at the repo root. `vercel.json`'s `rewrites` proxies `/api/*` to the API host and serves everything else via the SPA fallback — this keeps the frontend and API same-origin from the browser's point of view, so no CORS and no client code needs to know the API's real URL. **Before your first deploy**, replace the placeholder host in `vercel.json`'s first rewrite (`REPLACE_WITH_YOUR_API_HOST`) with your actual Render URL.
- **API → Render**, per `render.yaml` at the repo root (a Render "Blueprint" — see [render.com/docs/blueprint-spec](https://render.com/docs/blueprint-spec)). Connect the repo in the Render dashboard and it reads this file automatically. Env vars marked `sync: false` in `render.yaml` aren't in the file — Render prompts for them in its dashboard the first time you deploy.

**Which host needs which variable:**

| Variable | Vercel (frontend) | Render (API) |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | — |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ | — |
| `ANTHROPIC_API_KEY` | — | ✅ |
| `SUPABASE_URL` | — | ✅ |
| `SUPABASE_PUBLISHABLE_KEY` | — | ✅ |
| `SUPABASE_SECRET_KEY` | — | ✅ |
| `ALLOWED_ORIGINS` | — | ✅ (set to your Vercel URL) |
| `NODE_ENV` | — | ✅ (`production`) |
| `USER_MONTHLY_BUDGET_USD`, `SIGNUP_REQUIRE_INVITE`, `MAX_ACCOUNTS` | — | ✅ (all have safe defaults baked into `render.yaml`) |
| `SUPABASE_DB_URL` | — | — (only ever used to run migrations from your own machine, never by either deployed host) |

**Running migrations against production**: same command as local setup, pointed at your production `SUPABASE_DB_URL` (Supabase → Settings → Database) instead of a dev project:
```bash
SUPABASE_DB_URL="<production connection string>" \
  bash -c 'for f in supabase/migrations/*.sql; do psql "$SUPABASE_DB_URL" -f "$f" || break; done'
```
Run this from your own machine before or after a deploy that adds a new migration file — neither host runs migrations automatically.

**Flipping the signup/spend caps in production** — no code changes for any of these, only a redeploy (env vars) or a direct SQL statement (the database ones): see "Spend and signup caps" above for exactly what each one does and how to change it. In short: `SIGNUP_REQUIRE_INVITE` and `MAX_ACCOUNTS` are Render env vars (edit in `render.yaml` or the Render dashboard, then redeploy); `ai_service_state.monthly_budget_usd` and a specific student's `profiles.monthly_budget_usd` are database rows you update directly in Supabase.

## Where things live

- `artifacts/study-coach/src/pages/` — dashboard, onboarding, course workspace, tutor, quiz, and achievements pages
- `artifacts/study-coach/src/components/app-shell.tsx` — responsive navigation and shared UI primitives
- `artifacts/api-server/src/routes/` — Express route handlers (`study.ts`, `documents.ts`, `events.ts`, `achievements.ts`)
- `artifacts/api-server/src/lib/` — AI integration (`anthropic.ts`, `tutor.ts`, `quiz.ts`, `syllabus.ts`), document processing (`documents.ts`), badge computation (`badges.ts`)
- `lib/api-spec/openapi.yaml` — source of truth for the API contract
- `supabase/migrations/` — the full database schema, RLS policies, and storage bucket setup, as plain SQL applied directly against Supabase
- `scripts/post-merge.sh` — runs `pnpm install` after a git merge; wired up via `.replit`'s `postMerge` hook for anyone still using Replit, harmless (and unused) otherwise

## Regenerating the API client

After changing `lib/api-spec/openapi.yaml`:

```bash
pnpm --filter @workspace/api-spec run codegen
```

This regenerates the Zod schemas in `lib/api-zod` and the React Query hooks in `lib/api-client-react`.

## Security notes

- The Supabase secret (service role) key and the Anthropic API key are read only by the API server (`artifacts/api-server`) and are never bundled into frontend code — only `VITE_`-prefixed variables reach the browser.
- Every table is protected by Postgres Row Level Security (`supabase/migrations/0001_init.sql`, `0002_profiles_courses_events_badges.sql`); the API server never trusts a client-sent user id — it derives the authenticated user from the verified Supabase session on every request.
- Rotate any key immediately if it's ever pasted into a chat, ticket, or shared document.

## About the Replit-era files

This project still contains a few Replit-authored files (`.replit`, `replit.nix`, `.replitignore`, `artifacts/*/.replit-artifact`) and a couple of Vite plugins (`@replit/vite-plugin-*`) that are already self-guarding — they only activate when the `REPL_ID` environment variable is present, which it never is outside Replit. None of it is required to develop, build, or run this app anywhere else; it's left in place only so the project still opens cleanly in Replit if you ever want to.
