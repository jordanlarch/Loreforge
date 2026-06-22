import { describe, expect, it } from "vitest";

import { percentile, runSyncStress } from "./harness.js";

/** Roadmap §7 closed-alpha gate. */
const P95_BUDGET_MS = 500;
const TABLE_SIZE = 6;

describe("percentile", () => {
  it("uses nearest-rank and handles edges", () => {
    const xs = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(percentile(xs, 50)).toBe(50);
    expect(percentile(xs, 95)).toBe(100);
    expect(percentile(xs, 100)).toBe(100);
    expect(percentile([], 95)).toBe(0);
    expect(percentile([42], 95)).toBe(42);
  });
});

describe("Tier-4 6-client sync stress", () => {
  it("keeps P95 broadcast latency under budget and all clients converge", async () => {
    const report = await runSyncStress({ clients: TABLE_SIZE, ticks: 300 });

    // Record the run in CI logs (this is the "one sync-stress run with numbers
    // recorded" M5 exit artifact).
    console.log(
      `[sync-stress] ${report.clients} clients · ${report.broadcasts} broadcasts · ` +
        `p50=${report.latencyMs.p50.toFixed(2)}ms p95=${report.latencyMs.p95.toFixed(2)}ms ` +
        `max=${report.latencyMs.max.toFixed(2)}ms mean=${report.latencyMs.mean.toFixed(2)}ms · ` +
        `update p50=${report.updateBytes.p50}B max=${report.updateBytes.max}B`,
    );

    expect(report.clients).toBe(TABLE_SIZE);
    expect(report.broadcasts).toBeGreaterThanOrEqual(200);
    expect(report.converged).toBe(true);
    expect(report.latencyMs.p95).toBeLessThan(P95_BUDGET_MS);
  });
});
