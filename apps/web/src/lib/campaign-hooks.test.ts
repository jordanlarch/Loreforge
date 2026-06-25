import { describe, expect, it } from "vitest";

import {
  HOOK_STATUSES,
  HOOK_STATUS_LABEL,
  extractEntityHookTexts,
  groupHooksByStatus,
  isHookStatus,
  isRealmHookAccepted,
  pendingRealmHooks,
  sessionIndexForDate,
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

describe("Realms suggested feed", () => {
  it("extracts hook strings from entity data", () => {
    expect(extractEntityHookTexts({ hooks: ["  A clue ", "", 3] })).toEqual([
      "  A clue ",
    ]);
    expect(extractEntityHookTexts(null)).toEqual([]);
  });

  it("detects accepted Realms hooks by entity + title/summary", () => {
    const accepted = [
      {
        sourceEntityId: "ent-1",
        title: "The missing ledger",
        summary: "The missing ledger",
      },
    ];
    expect(
      isRealmHookAccepted("ent-1", "The missing ledger", accepted),
    ).toBe(true);
    expect(isRealmHookAccepted("ent-1", "Another hook", accepted)).toBe(false);
    expect(isRealmHookAccepted("ent-2", "The missing ledger", accepted)).toBe(
      false,
    );
  });

  it("lists pending hooks only for campaign world entities", () => {
    const pending = pendingRealmHooks({
      worldEntityIds: ["ent-1"],
      entities: [
        {
          id: "ent-1",
          name: "Salt Way",
          data: { hooks: ["Washout", "Smugglers"] },
        },
        {
          id: "ent-2",
          name: "Other",
          data: { hooks: ["Hidden"] },
        },
      ],
      accepted: [
        {
          sourceEntityId: "ent-1",
          title: "Washout",
          summary: "Washout",
        },
      ],
    });
    expect(pending).toEqual([
      {
        entityId: "ent-1",
        entityName: "Salt Way",
        title: "Smugglers",
        summary: "Smugglers",
        templateId: pending[0]?.templateId,
      },
    ]);
  });
});

describe("sessionIndexForDate", () => {
  const sessions = [
    { endedAt: "2026-06-20T12:00:00Z" },
    { endedAt: "2026-06-22T12:00:00Z" },
    { endedAt: "2026-06-24T12:00:00Z" },
  ];

  it("maps dates to session numbers by endedAt", () => {
    expect(sessionIndexForDate(sessions, "2026-06-19T12:00:00Z")).toBe(1);
    expect(sessionIndexForDate(sessions, "2026-06-21T12:00:00Z")).toBe(2);
    expect(sessionIndexForDate(sessions, "2026-06-25T12:00:00Z")).toBe(3);
  });

  it("returns null when there are no sessions", () => {
    expect(sessionIndexForDate([], "2026-06-21T12:00:00Z")).toBeNull();
  });
});
