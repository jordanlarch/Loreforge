# Tier-4 Sync-Stress Baseline (C3)

The closed-alpha gate (`docs/02-implementation-roadmap.md` §7) requires live
combat sync to fan a server broadcast out to a **6-client table with P95 <
500ms**. This doc records the harness and its first recorded run.

## Harness

`services/ws-server/src/sync-stress/harness.ts` (`runSyncStress`).

It models the production broadcast fan-out without real sockets:

1. Seeds the goblin-ambush `BattleRoom` (the real engine authority).
2. Wires N client `Y.Doc`s to a server `Y.Doc`'s update stream.
3. Ticks legal `end_turn`s; after each accepted action it folds the
   authoritative `WorldState` into the server doc with the production
   `writeProjection`, then applies the resulting **Yjs incremental update** to
   every client doc and has each reassemble its projection (`readProjection`) —
   exactly the work each connected browser does.
4. Reports latency percentiles, per-broadcast update size, and a **convergence**
   check (every client agrees with the server's `lastSequence`).

### Scope / caveats

- Measures the **local** broadcast cost: engine apply → projection diff → encode
  → N× (apply + read). This is the part measurable deterministically in CI.
- **Network RTT is out of scope** — a real 6-client WAN test belongs to a
  load-testing pass against a deployed Hocuspocus instance (deferred; see
  `docs/deferrals.md`). The number below is a CPU-cost floor, not an end-to-end
  WAN latency.

## Recorded run

Run via `npm run test --workspace @app/ws-server` (the `Tier-4 6-client sync
stress` test logs a `[sync-stress] …` line and asserts P95 < 500ms).

| Param | Value |
|---|---|
| Clients | 6 |
| Broadcasts | 300 |
| Latency p50 | ~0.5 ms |
| Latency **p95** | **~1.1 ms** |
| Latency max | ~3.4 ms |
| Update size (p50) | ~1.2 KB |
| Converged | yes (all 6 clients) |

(Representative dev-machine numbers; exact values vary per host. The CI assertion
is the durable gate: P95 < 500ms with 6 clients over ≥200 broadcasts, all
converged.)

## Next steps (deferred)

- WAN load test against a deployed Hocuspocus (real RTT, real client count).
- Drive a richer action mix (moves + attacks + spells) rather than `end_turn`
  churn, to exercise larger entity-diff broadcasts.
- Track the recorded p95 over time to catch projection/engine regressions.
