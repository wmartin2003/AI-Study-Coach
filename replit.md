# AI Study Coach

AI Study Coach turns a student's course material into a focused daily plan, guided tutoring, adaptive quizzes, and targeted review.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/study-coach/src/pages/` — dashboard, course workspace, tutor, quiz, and new-course flows
- `artifacts/study-coach/src/components/app-shell.tsx` — responsive navigation and shared UI
- `lib/api-spec/openapi.yaml` — source of truth for study API contracts
- `artifacts/api-server/src/routes/study.ts` — study endpoints and seeded MVP data
- `artifacts/study-coach/src/index.css` — app theme and visual tokens

## Architecture decisions

- The first slice uses the shared API server with a small in-memory seed so the core loop is immediately usable without requiring sign-in or course ingestion.
- The frontend consumes generated React Query hooks from the OpenAPI contract rather than hand-written client types.
- The product centers on one daily next step, with tutoring and quizzes as adjacent actions from the same course context.

## Product

Students can see today's plan and progress, open a Computer Networks course workspace, ask a Socratic tutor for help, take an adaptive quiz, and create another course.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after changing the API contract.
- The current generated Zod setup does not support `zod.int()`; OpenAPI numeric fields use `number` for compatibility.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
