import { describe, expect, it } from "vitest";

import {
  HOOK_STATUSES,
  HOOK_STATUS_LABEL,
  groupHooksByStatus,
  isHookStatus,
} from "./campaign-hooks";

describe("plot-hook lifecycle", () => {
  it("declares the five lifecycle stages with labels", () => {
    expect(HOOK_STATUSES).toEqual([
      "suggested",
      "open",
      "active",
      "resolved",
      "abandoned",
    ]);
    for (const status of HOOK_STATUSES) {
      expect(HOOK_STATUS_LABEL[status]).toBeTruthy();
    }
  });

  it("guards known statuses", () => {
    expect(isHookStatus("active")).toBe(true);
    expect(isHookStatus("nonsense")).toBe(false);
    expect(isHookStatus(null)).toBe(false);
  });
});

describe("groupHooksByStatus", () => {
  it("buckets hooks into all five columns, preserving order", () => {
    const hooks = [
      { id: "1", status: "open" },
      { id: "2", status: "active" },
      { id: "3", status: "open" },
      { id: "4", status: "resolved" },
    ];
    const grouped = groupHooksByStatus(hooks);
    expect(Object.keys(grouped)).toEqual([...HOOK_STATUSES]);
    expect(grouped.open.map((h) => h.id)).toEqual(["1", "3"]);
    expect(grouped.active.map((h) => h.id)).toEqual(["2"]);
    expect(grouped.resolved.map((h) => h.id)).toEqual(["4"]);
    expect(grouped.suggested).toEqual([]);
    expect(grouped.abandoned).toEqual([]);
  });

  it("ignores hooks with an unknown status", () => {
    const grouped = groupHooksByStatus([{ id: "x", status: "bogus" }]);
    for (const status of HOOK_STATUSES) {
      expect(grouped[status]).toEqual([]);
    }
  });
});
