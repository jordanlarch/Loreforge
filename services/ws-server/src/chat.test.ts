import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import {
  appendChat,
  chatArray,
  composeChat,
  eventEntry,
  isChatInput,
  isOoc,
  rollDice,
  stripOoc,
} from "./chat.js";

/** Deterministic stamping for assertions. */
function deps(rng?: () => number) {
  let n = 0;
  return { uuid: () => `id-${n++}`, now: () => 1000, rng };
}

describe("rollDice", () => {
  it("rolls NdM±K with an injected RNG", () => {
    const roll = rollDice("2d6+3", () => 0.5);
    expect(roll).not.toBeNull();
    expect(roll!.rolls).toEqual([4, 4]);
    expect(roll!.modifier).toBe(3);
    expect(roll!.total).toBe(11);
    expect(roll!.notation).toBe("2d6+3");
  });

  it("defaults the count to 1 and the modifier to 0", () => {
    const roll = rollDice("d20", () => 0);
    expect(roll!.rolls).toEqual([1]);
    expect(roll!.notation).toBe("1d20");
  });

  it("rejects malformed or out-of-bounds notation", () => {
    expect(rollDice("hello")).toBeNull();
    expect(rollDice("0d6")).toBeNull();
    expect(rollDice("1d1")).toBeNull();
    expect(rollDice("999d6")).toBeNull();
  });
});

describe("ooc helpers", () => {
  it("detects and strips double-paren out-of-character text", () => {
    expect(isOoc("((brb))")).toBe(true);
    expect(isOoc("hello")).toBe(false);
    expect(isOoc("(())")).toBe(false);
    expect(stripOoc("((  grabbing coffee ))")).toBe("grabbing coffee");
  });
});

describe("composeChat", () => {
  it("produces a player line plus a stubbed GM echo for normal input", () => {
    const entries = composeChat(
      { author: "Player", mode: "speak", text: "Hail, traveler." },
      deps(),
    );
    expect(entries.map((e) => e.kind)).toEqual(["player", "gm"]);
    expect(entries[0]!.mode).toBe("speak");
    expect(entries[1]!.author).toBe("GM");
  });

  it("turns /roll into a single dice widget entry", () => {
    const entries = composeChat(
      { author: "Player", text: "/roll 1d20+5" },
      deps(() => 0.95),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]!.kind).toBe("roll");
    expect(entries[0]!.dice?.notation).toBe("1d20+5");
  });

  it("classifies ((ooc)) input", () => {
    const entries = composeChat({ author: "Player", text: "((afk))" }, deps());
    expect(entries).toHaveLength(1);
    expect(entries[0]!.kind).toBe("ooc");
    expect(entries[0]!.text).toBe("afk");
  });

  it("ignores empty input", () => {
    expect(composeChat({ author: "Player", text: "   " }, deps())).toEqual([]);
  });
});

describe("eventEntry", () => {
  it("describes engine actions tersely", () => {
    expect(eventEntry({ type: "end_turn" }, deps()).text).toMatch(/ended/i);
    expect(
      eventEntry(
        { type: "move_entity", entity: "e1", to: { x: 2, y: 3 } },
        deps(),
      ).text,
    ).toContain("(2, 3)");
    expect(
      eventEntry(
        {
          type: "attack",
          attacker: "a",
          target: "b",
          attackBonus: 5,
          damage: { notation: "1d8+3", type: "slashing" },
        },
        deps(),
      ).text,
    ).toMatch(/attack/i);
  });
});

describe("isChatInput", () => {
  it("guards the untrusted payload shape", () => {
    expect(isChatInput({ text: "hi" })).toBe(true);
    expect(isChatInput({ text: "hi", mode: "speak" })).toBe(true);
    expect(isChatInput({ text: "" })).toBe(false);
    expect(isChatInput({ mode: "speak" })).toBe(false);
    expect(isChatInput(null)).toBe(false);
  });
});

describe("appendChat", () => {
  it("pushes entries onto the shared chat array", () => {
    const doc = new Y.Doc();
    appendChat(doc, composeChat({ author: "Player", text: "((hi))" }, deps()));
    expect(chatArray(doc).toArray()).toHaveLength(1);
    expect(chatArray(doc).get(0).kind).toBe("ooc");
  });
});
