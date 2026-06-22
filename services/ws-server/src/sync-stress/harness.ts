/**
 * Tier-4 sync-stress harness (C3) — closed-alpha forcing function.
 *
 * The roadmap §7 alpha gate requires the live combat sync to fan a server
 * broadcast out to a 6-client table with **P95 < 500ms**. This harness models
 * that fan-out faithfully without real sockets: it drives the authoritative
 * {@link BattleRoom} engine, folds each resulting state into a server `Y.Doc`
 * via the production {@link writeProjection}, and applies the resulting Yjs
 * incremental update to N client docs that each reassemble the projection
 * ({@link readProjection}) — exactly the work each connected browser does.
 *
 * What it measures is the *local* broadcast cost (engine apply → projection diff
 * → encode → N× apply+read), which is the part we can measure deterministically
 * in CI. Real network RTT is out of scope here; this establishes the harness and
 * a recorded CPU-cost baseline (see `docs/perf/sync-stress.md`), and gates that
 * the in-process path stays comfortably under budget as the engine/projection
 * grow.
 *
 * @see services/ws-server/src/projection.ts · docs/deferrals.md (C3)
 */
import { performance } from "node:perf_hooks";

import * as Y from "yjs";
import type { BattleAction } from "@app/engine";

import { readProjection, writeProjection } from "../projection.js";
import { BattleRoom } from "../room.js";

/** Nearest-rank percentile of an unsorted sample (returns 0 for an empty set). */
export function percentile(samples: readonly number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  const idx = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[idx]!;
}

export type StressReport = {
  clients: number;
  /** Broadcasts actually measured (accepted actions that changed the doc). */
  broadcasts: number;
  latencyMs: { p50: number; p95: number; max: number; mean: number };
  /** Yjs incremental-update size fanned out per broadcast. */
  updateBytes: { p50: number; max: number };
  /** True when every client converged to the server's last sequence number. */
  converged: boolean;
};

/**
 * Run a 6-(or N-)client broadcast stress pass. Seeds the goblin-ambush room,
 * wires `clients` Yjs docs to the server doc's update stream, then ticks
 * `ticks` legal `end_turn`s (each advances initiative and broadcasts the
 * encounter delta). Returns latency/size percentiles and a convergence check.
 */
export async function runSyncStress(opts: {
  clients: number;
  ticks: number;
}): Promise<StressReport> {
  const room = new BattleRoom();
  await room.ensureSeeded();

  const server = new Y.Doc();
  const clients = Array.from({ length: opts.clients }, () => new Y.Doc());

  // Capture each incremental update the server doc emits (what Hocuspocus would
  // encode and broadcast to every connection).
  let lastUpdate: Uint8Array | null = null;
  server.on("update", (update: Uint8Array) => {
    lastUpdate = update;
  });

  // Initial full sync so clients start from the seeded battle.
  writeProjection(server, await room.getState());
  if (lastUpdate) {
    for (const c of clients) Y.applyUpdate(c, lastUpdate);
  }

  const latencies: number[] = [];
  const sizes: number[] = [];

  for (let i = 0; i < opts.ticks; i += 1) {
    const t0 = performance.now();
    const res = await room.apply({ type: "end_turn" } as BattleAction);
    if (!res.accepted) continue;
    const state = await room.getState();

    lastUpdate = null;
    writeProjection(server, state); // fires the update handler if anything changed
    if (lastUpdate) {
      const update = lastUpdate as Uint8Array;
      for (const c of clients) {
        Y.applyUpdate(c, update);
        readProjection(c); // each client reassembles its WorldState subset
      }
      sizes.push(update.byteLength);
      latencies.push(performance.now() - t0);
    }
  }

  // Correctness under load: every client must agree with the server.
  const serverSeq = readProjection(server)?.lastSequence ?? -1;
  const converged = clients.every(
    (c) => readProjection(c)?.lastSequence === serverSeq,
  );

  const mean =
    latencies.length === 0
      ? 0
      : latencies.reduce((s, x) => s + x, 0) / latencies.length;

  return {
    clients: opts.clients,
    broadcasts: latencies.length,
    latencyMs: {
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      max: percentile(latencies, 100),
      mean,
    },
    updateBytes: {
      p50: percentile(sizes, 50),
      max: percentile(sizes, 100),
    },
    converged,
  };
}
