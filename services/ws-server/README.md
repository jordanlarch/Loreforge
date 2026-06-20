# `@app/ws-server` — WebSocket sync server (Tier 4)

The Yjs / Hocuspocus WebSocket service for real-time multiplayer play (#14).
Vercel hosts `@app/web`; this service runs on **Railway** (or Fly.io) for
long-lived connections.

## Architecture (scope A)

The WS server is the **authoritative engine host** for live play, not a dumb
relay (`docs/engine/architecture.md` §10):

- Clients connect over WebSocket, authenticated by their **Supabase session
  JWT** (`onAuthenticate`, verified offline against the project's public **JWKS**
  — ES256/RS256 signing keys — with an optional legacy HS256 secret fallback).
- Each connection joins its own per-user room `sandbox:{userId}`.
- A room owns an in-memory `@app/engine` `Engine` seeded from the goblin-ambush
  fixture (`BattleRoom`). Clients submit `BattleAction`s over the stateless
  channel (`{ t: "cmd", action }` / `{ t: "reset" }`); the engine validates and
  applies them.
- The resulting `WorldState` projection is written into a shallow-structured
  Y.Doc (`writeProjection`) and broadcast. Clients render from the synced doc
  and **never compute mechanics**. Illegal actions get a `{ t: "rejected" }`
  stateless reply.

Scope A is stateless: rooms are in-memory only and re-seed from the fixture on a
cold load. Scope B swaps the seed source for a persisted per-campaign event
store and keys rooms off campaign membership — the rest is unchanged.

## Develop

```powershell
# From repo root. Uses NEXT_PUBLIC_SUPABASE_URL (already in .env.local) for JWKS.
npm run dev:ws
```

The server listens on `PORT` (default `1234`). Point the web app at it via
`NEXT_PUBLIC_WS_URL` (default `ws://localhost:1234`).

| Script | Purpose |
|---|---|
| `npm run dev -w @app/ws-server` | watch-mode server (`tsx watch`) |
| `npm run start -w @app/ws-server` | run the server (deploy entrypoint) |
| `npm run typecheck -w @app/ws-server` | `tsc --noEmit` |
| `npm run test -w @app/ws-server` | Vitest (projection / room / auth) |

## Env

| Var | Required | Notes |
|---|---|---|
| `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL` | yes* | Project base URL; the JWKS endpoint (`/auth/v1/.well-known/jwks.json`) is derived from it to verify session tokens (ES256/RS256). |
| `SUPABASE_JWT_SECRET` | no | Legacy HS256 shared secret. Optional fallback for the signing-key migration window. |
| `PORT` / `WS_PORT` | no | Listen port (default `1234`). Railway injects `PORT`. |

\* At least one verification method must be configured — the JWKS URL (preferred) and/or the legacy secret.

## Deploy

`railway.toml` is the deploy config (NIXPACKS, `/health` check). Provisioning is
deferred until needed; flip the web app's `NEXT_PUBLIC_WS_URL` to the deployed
URL when live.
