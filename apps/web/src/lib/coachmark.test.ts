import { describe, expect, it } from "vitest";

import {
  isTriggerReady,
  mergeSeen,
  readyTriggerIds,
  remainingCount,
  selectActiveCoachmark,
  type CoachmarkDef,
} from "./coachmark";

const defs: CoachmarkDef[] = [
  {
    id: "map",
    anchor: "map",
    title: "Map",
    body: "",
    trigger: { kind: "first_seen" },
  },
  {
    id: "hud",
    anchor: "hud",
    title: "HUD",
    body: "",
    trigger: { kind: "on_action", action: "opened-sheet" },
  },
  {
    id: "chat",
    anchor: "chat",
    title: "Chat",
    body: "",
    trigger: { kind: "after_delay_ms", ms: 2000 },
  },
];

function ctx(over: {
  anchorsPresent?: string[];
  firedActions?: string[];
  elapsedDelayIds?: string[];
}) {
  return {
    anchorsPresent: new Set(over.anchorsPresent ?? []),
    firedActions: new Set(over.firedActions ?? []),
    elapsedDelayIds: new Set(over.elapsedDelayIds ?? []),
  };
}

describe("mergeSeen", () => {
  it("unions server-persisted and session-local seen ids", () => {
    const seen = mergeSeen(["a", "b"], ["b", "c"]);
    expect([...seen].sort()).toEqual(["a", "b", "c"]);
  });
});

describe("isTriggerReady", () => {
  it("first_seen fires once its anchor is present", () => {
    expect(isTriggerReady(defs[0]!, ctx({}))).toBe(false);
    expect(isTriggerReady(defs[0]!, ctx({ anchorsPresent: ["map"] }))).toBe(true);
  });

  it("on_action fires only when its action has fired", () => {
    expect(isTriggerReady(defs[1]!, ctx({}))).toBe(false);
    expect(
      isTriggerReady(defs[1]!, ctx({ firedActions: ["opened-sheet"] })),
    ).toBe(true);
  });

  it("after_delay_ms fires only once its timer is recorded elapsed", () => {
    expect(isTriggerReady(defs[2]!, ctx({}))).toBe(false);
    expect(isTriggerReady(defs[2]!, ctx({ elapsedDelayIds: ["chat"] }))).toBe(
      true,
    );
  });
});

describe("readyTriggerIds", () => {
  it("collects every def whose trigger condition is met", () => {
    const ready = readyTriggerIds(
      defs,
      ctx({ anchorsPresent: ["map"], elapsedDelayIds: ["chat"] }),
    );
    expect([...ready].sort()).toEqual(["chat", "map"]);
  });
});

describe("selectActiveCoachmark", () => {
  it("shows the first triggered, unseen def in declaration order", () => {
    const triggered = new Set(["map", "hud"]);
    const active = selectActiveCoachmark(defs, new Set(), triggered);
    expect(active?.id).toBe("map");
  });

  it("skips seen defs", () => {
    const triggered = new Set(["map", "hud"]);
    const active = selectActiveCoachmark(defs, new Set(["map"]), triggered);
    expect(active?.id).toBe("hud");
  });

  it("returns null when nothing is both triggered and unseen", () => {
    expect(selectActiveCoachmark(defs, new Set(), new Set())).toBeNull();
    expect(
      selectActiveCoachmark(defs, new Set(["map"]), new Set(["map"])),
    ).toBeNull();
  });

  it("does not re-fire a dismissed coachmark", () => {
    // map triggered + dismissed → next eligible is the triggered hud, not map.
    const triggered = new Set(["map", "hud"]);
    const seen = mergeSeen([], ["map"]);
    expect(selectActiveCoachmark(defs, seen, triggered)?.id).toBe("hud");
  });
});

describe("remainingCount", () => {
  it("counts not-yet-seen coachmarks", () => {
    expect(remainingCount(defs, new Set())).toBe(3);
    expect(remainingCount(defs, new Set(["map", "hud"]))).toBe(1);
    expect(remainingCount(defs, new Set(["map", "hud", "chat"]))).toBe(0);
  });
});
