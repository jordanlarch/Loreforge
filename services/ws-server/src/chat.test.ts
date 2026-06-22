import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import {
  appendChat,
  chatArray,
  composePlayerInput,
  eventEntry,
  gmEntry,
  isChatInput,
  isOoc,
  resolutionEntry,
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

describe("composePlayerInput", () => {
  it("produces just the player line and flags a GM response for normal input", () => {
    const { entries, respond } = composePlayerInput(
      { author: "Player", mode: "speak", text: "Hail, traveler." },
      deps(),
    );
    expect(entries.map((e) => e.kind)).toEqual(["player"]);
    expect(entries[0]!.mode).toBe("speak");
    expect(respond).toBe(true);
  });

  it("turns /roll into a single dice widget entry with no GM response", () => {
    const { entries, respond } = composePlayerInput(
      { author: "Player", text: "/roll 1d20+5" },
      deps(() => 0.95),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]!.kind).toBe("roll");
    expect(entries[0]!.dice?.notation).toBe("1d20+5");
    expect(respond).toBe(false);
  });

  it("classifies ((ooc)) input and suppresses the GM response", () => {
    const { entries, respond } = composePlayerInput(
      { author: "Player", text: "((afk))" },
      deps(),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]!.kind).toBe("ooc");
    expect(entries[0]!.text).toBe("afk");
    expect(respond).toBe(false);
  });

  it("ignores empty input", () => {
    const { entries, respond } = composePlayerInput(
      { author: "Player", text: "   " },
      deps(),
    );
    expect(entries).toEqual([]);
    expect(respond).toBe(false);
  });
});

describe("gmEntry", () => {
  it("stamps a GM entry and carries mentions when present", () => {
    const entry = gmEntry("The door creaks open.", deps(), {
      mentions: ["Old Door"],
    });
    expect(entry.kind).toBe("gm");
    expect(entry.author).toBe("GM");
    expect(entry.mentions).toEqual(["Old Door"]);
  });

  it("omits mentions when none are referenced", () => {
    const entry = gmEntry("Silence falls.", deps());
    expect(entry.mentions).toBeUndefined();
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
    expect(
      eventEntry(
        {
          type: "opportunity_attack",
          reactor: "a",
          target: "b",
          attackBonus: 5,
          damage: { notation: "1d8+3", type: "slashing" },
        },
        deps(),
      ).text,
    ).toMatch(/opportunity/i);
    expect(
      eventEntry(
        {
          type: "cast_spell",
          caster: "a",
          spellId: "fire-bolt",
          slotLevel: 0,
          targets: ["b"],
        },
        deps(),
      ).text,
    ).toMatch(/fire-bolt/);
  });
});

describe("resolutionEntry (#99)", () => {
  const names: Record<string, string> = {
    thorin: "Thorin",
    goblin: "Goblin",
    elara: "Elara",
  };
  const nameOf = (id: string) => names[id] ?? id;

  it("renders a hit with the roll, AC and damage", () => {
    const entry = resolutionEntry(
      {
        type: "attack",
        attacker: "thorin",
        target: "goblin",
        attackBonus: 5,
        damage: { notation: "1d8+3", type: "slashing" },
      },
      {
        attacker: "thorin",
        target: "goblin",
        attackTotal: 18,
        targetAc: 13,
        hit: true,
        critical: false,
        damageType: "slashing",
        damage: 7,
        downed: false,
      },
      nameOf,
      deps(),
    );
    expect(entry.text).toContain("Thorin hits Goblin");
    expect(entry.text).toContain("18 vs AC 13");
    expect(entry.text).toContain("7 slashing");
  });

  it("renders a miss", () => {
    const entry = resolutionEntry(
      {
        type: "attack",
        attacker: "thorin",
        target: "goblin",
        attackBonus: 5,
        damage: { notation: "1d8", type: "slashing" },
      },
      { attacker: "thorin", target: "goblin", attackTotal: 8, targetAc: 13, hit: false },
      nameOf,
      deps(),
    );
    expect(entry.text).toMatch(/misses Goblin/);
    expect(entry.text).toContain("8 vs AC 13");
  });

  it("renders an AoE save spell with the failure count and total damage", () => {
    const entry = resolutionEntry(
      {
        type: "cast_spell",
        caster: "elara",
        spellId: "fireball",
        slotLevel: 3,
        targets: [],
        origin: { x: 5, y: 5 },
      },
      {
        caster: "elara",
        spellName: "Fireball",
        slotLevel: 3,
        targets: 3,
        failures: 2,
        rolledDamage: 24,
        damage: 60,
        save: "dex",
        dc: 15,
      },
      nameOf,
      deps(),
    );
    expect(entry.text).toContain("Elara casts Fireball");
    expect(entry.text).toContain("2/3 failed the DEX save DC 15");
    expect(entry.text).toContain("60 total damage");
  });

  it("renders a single-target spell attack outcome", () => {
    const entry = resolutionEntry(
      {
        type: "cast_spell",
        caster: "elara",
        spellId: "guiding-bolt",
        slotLevel: 1,
        targets: ["goblin"],
      },
      {
        caster: "elara",
        spellName: "Guiding Bolt",
        slotLevel: 1,
        target: "goblin",
        hit: true,
        critical: false,
        damage: 14,
      },
      nameOf,
      deps(),
    );
    expect(entry.text).toContain("Elara casts Guiding Bolt");
    expect(entry.text).toContain("hits Goblin");
    expect(entry.text).toContain("14 damage");
  });

  it("falls back to the terse description when the summary lacks detail", () => {
    const entry = resolutionEntry(
      { type: "end_turn" },
      undefined,
      nameOf,
      deps(),
    );
    expect(entry.text).toMatch(/ended/i);
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
    appendChat(
      doc,
      composePlayerInput({ author: "Player", text: "((hi))" }, deps()).entries,
    );
    expect(chatArray(doc).toArray()).toHaveLength(1);
    expect(chatArray(doc).get(0).kind).toBe("ooc");
  });
});
