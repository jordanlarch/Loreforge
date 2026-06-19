# Loreforge

AI-GM 5E SRD web app. Design docs live in `docs/`; application code starts here (P0 Foundation).

## Prerequisites

- Node.js 20+ (22 recommended)
- A [Supabase](https://supabase.com) project (Postgres, Auth, Storage)
- Optional: a [Trigger.dev](https://trigger.dev) account for background jobs (cloud-hosted; tasks run on Trigger.dev infra)

## Quick start

1. Copy environment template:

   ```powershell
   Copy-Item .env.example .env.local
   ```

2. Fill in Supabase URL, anon key, service role key, and `DATABASE_URL` from the Supabase dashboard.

3. Install dependencies and run migrations:

   ```powershell
   npm install
   npm run db:migrate
   ```

4. Start the app:

   ```powershell
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000). Sign up / sign in via Supabase Auth; you should land on an authenticated **Home** shell.

6. (Optional) Work on background jobs — run the Trigger.dev dev environment in a second terminal. This is only needed when developing/testing tasks; the app runs fine without it.

   ```powershell
   npm run trigger:dev -w @app/web
   ```

## Monorepo layout

| Package | Path | Role |
|---------|------|------|
| `@app/web` | `apps/web` | Next.js App Router, tRPC, Supabase Auth, Trigger.dev tasks |
| `@app/db` | `packages/db` | Drizzle schema, migrations, Open5e ingest spike |
| `@app/engine` | `packages/engine` | Deterministic rules engine (stub in P0) |
| `@app/config` | `packages/config` | Zod-validated environment |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run typecheck` | Typecheck all workspaces |
| `npm run db:generate` | Generate Drizzle migrations from schema |
| `npm run db:migrate` | Apply migrations |
| `npm run ingest:open5e` | Spike: fetch Open5e spells into `codex_spells` |
| `npm run trigger:dev -w @app/web` | Run Trigger.dev tasks against your dev environment |
| `npm run trigger:deploy -w @app/web` | Deploy tasks to Trigger.dev |

## P0 exit criterion

Authenticated user lands on empty Home with six-item nav. See `docs/02-implementation-roadmap.md` §6.

## GitHub / CI

Push to `main` runs `.github/workflows/ci.yml` (install, typecheck, lint, build). Connect the repo per `AGENTS.md` if not already linked to [github.com/jordanlarch/Loreforge](https://github.com/jordanlarch/Loreforge).

## Deploy skeletons

- **Vercel** — `apps/web` (root directory in project settings)
- **Railway / Fly** — `services/ws-server` placeholder for Tier-4 WebSocket (P2+)
