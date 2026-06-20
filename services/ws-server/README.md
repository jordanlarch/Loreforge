# `@app/ws-server` — WebSocket sync server (Tier 4)

The Yjs / Hocuspocus WebSocket service for real-time multiplayer play (#14).
Vercel hosts `@app/web`; this service runs on **Railway** (or Fly.io) for
long-lived connections.

## Architecture

The WS server is the **authoritative engine host** for live play, not a dumb
relay (`docs/engine/architecture.md` §10):

- Clients connect over WebSocket, authenticated by their **Supabase session
  JWT** (`onAuthenticate`, verified offline against the project's public **JWKS**
  — ES256/RS256 signing keys — with an optional legacy HS256 secret fallback).
- A room owns an `@app/engine` `Engine`. Clients submit `BattleAction`s over the
  stateless channel (`{ t: "cmd", action }` / `{ t: "reset" }`); the engine
  validates and applies them.
- The resulting `WorldState` projection is written into a shallow-structured
  Y.Doc (`writeProjection`) and broadcast. Clients render from the synced doc
  and **never compute mechanics**. Illegal actions get a `{ t: "rejected" }`
  stateless reply that flashes only on the actor's tab.

Two room kinds are served, distinguished by `documentName` prefix
(`parseRoom`):

| Room | Backing | Auth | Lifecycle |
|---|---|---|---|
| `sandbox:{userId}` (scope A) | in-memory `BattleRoom`, seeded from the goblin-ambush fixture | a client may only join its own id | stateless; re-seeds from the fixture on cold load |
| `campaign:{campaignId}` (scope B) | `CampaignRoom` over `PgEventStore` — the WS server is the **sole authoritative writer** | only the campaign **owner** may join (`isCampaignOwner`) | seed-if-empty from the fixture on first load; state rebuilds from the persisted log on cold load; `reset` truncates back to the seeded baseline |

### Reconnect / resync

Hocuspocus owns the reconnect path: the client `HocuspocusProvider`
auto-reconnects on a dropped socket and the server re-runs `onLoadDocument`,
rehydrating the room (from the fixture for `sandbox:`, from the Postgres event
log for `campaign:`) and re-broadcasting the full projection. Because the doc is
a disposable projection of authoritative state — not the source of truth — a
reconnecting client converges on the current `WorldState` with no client-side
merge. `unloadImmediately` drops a room once its last client leaves; the next
join reloads it.

### Latency target

The Tier 4 budget lives in `docs/engine/architecture.md` §10.4. The relevant
target for this service is **projection-update broadcast: P50 < 10ms, P95 <
30ms** (engine-internal), with an **end-to-end P95 < 50ms** including the WS
hop for a simple command (move / end turn). Load-tested measurement against the
deployed Railway instance is deferred until provisioning (see Deploy); the
documented targets are the acceptance bar to validate then.

## Develop

```powershell
# From repo root. Loads .env.local: NEXT_PUBLIC_SUPABASE_URL (JWKS) for all
# rooms, plus DATABASE_URL for campaign:{id} rooms (the persisted event store).
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
| `DATABASE_URL` | yes† | Postgres connection for `campaign:{id}` rooms (the `PgEventStore` and the owner check). Lazy — only read when the first campaign room loads, so `sandbox:` demos boot without it. |
| `PORT` / `WS_PORT` | no | Listen port (default `1234`). Railway injects `PORT`. |

\* At least one verification method must be configured — the JWKS URL (preferred) and/or the legacy secret.

† Required to serve persisted campaign rooms; not needed for the `sandbox:` fixture demo.

## Deploy

`railway.toml` is the deploy config (NIXPACKS, `/health` check). Provisioning is
deferred until needed; flip the web app's `NEXT_PUBLIC_WS_URL` to the deployed
URL when live.
