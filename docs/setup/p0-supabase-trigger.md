# P0 — Supabase & Trigger.dev setup

Step-by-step for Jordan after the monorepo scaffold lands.

## Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication → Providers**: enable Email; add Google / Discord / GitHub when ready.
3. **Authentication → URL configuration**:
   - Site URL: `http://localhost:3000` (dev)
   - Redirect URLs: `http://localhost:3000/auth/callback`
4. Copy **Project URL** and **anon key** → `.env.local` as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. **Settings → API** → service role key → `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose to client).
6. **Settings → Database** → connection string (Transaction pooler, port 6543) → `DATABASE_URL`.
7. Run migrations from repo root:

   ```powershell
   npm run db:migrate
   ```

## Trigger.dev

Background jobs run on Trigger.dev's cloud infrastructure — there is no long-running server to host or restart. Your task code (in `apps/web/src/trigger/`) is deployed to Trigger.dev; the app triggers tasks via the SDK.

1. Create an account + project at [trigger.dev](https://trigger.dev).
2. **Project settings** → copy the **project ref** (`proj_…`) → `.env.local` as `TRIGGER_PROJECT_REF`.
3. **API keys** → copy the **DEV secret key** → `.env.local` as `TRIGGER_SECRET_KEY`.
4. Local development (only needed when working on tasks; second terminal):

   ```powershell
   npm run trigger:dev -w @app/web
   ```

   This runs your tasks against your Trigger.dev **dev** environment. The Next.js app runs fine without it — you only need it to exercise jobs locally.
5. Deploy tasks to the cloud (later / CI):

   ```powershell
   npm run trigger:deploy -w @app/web
   ```

> Note: unlike a queue server (e.g. BullMQ + Redis), Trigger.dev needs no always-on worker and no Redis. Tasks execute on Trigger.dev infra and are not bound by Vercel's serverless timeout, which suits the long-running generation cascades in P3+.

## Vercel

1. Import `jordanlarch/Loreforge` from GitHub.
2. Root directory: `apps/web` (or use monorepo install per `vercel.json`).
3. Add all env vars from `.env.example` (including `TRIGGER_SECRET_KEY` — use the **prod** key in production).

## Open5e spike

```powershell
npm run ingest:open5e
```

Requires `DATABASE_URL` and network access to `api.open5e.com`.
