import { describe, expect, it } from "vitest";

import { createFakeLlmClient } from "@app/llm";
import type { WorldState } from "@app/engine";

import {
  activePlayerEntity,
  decideCheck,
  decideMonsterTarget,
  narrate,
  narrateEnemyTurn,
} from "./narration.js";
import type { ChatEntry } from "./chat.js";

/** A minimal world: one scene with a goblin + a hero present. */
function world(): WorldState {
  return {
    campaignId: "c1",
    currentSceneId: "s1",
    scenes: { s1: { id: "s1", name: "The Mossy Cave", description: "Dripping dark." } },
    entities: {
      hero: {
        id: "hero",
        name: "Thorin",
        kind: "character",
        alive: true,
        sceneId: "s1",
      },
      goblin: {
        id: "goblin",
        name: "Snik",
        kind: "monster",
        alive: true,
        sceneId: "s1",
      },
      offscreen: {
        id: "offscreen",
        name: "Faraway Bob",
        kind: "character",
        alive: true,
        sceneId: "s2",
      },
    },
    lastSequence: 0,
  } as unknown as WorldState;
}

const chat: ChatEntry[] = [
  { id: "1", kind: "player", author: "Thorin", text: "I draw my axe.", ts: 1 },
];

describe("narrate", () => {
  it("returns narration text and keeps only on-scene mentions", async () => {
    const client = createFakeLlmClient({
      input: {
        narration: "Snik hisses as your axe clears its sheath.",
        mentions: ["Snik", "Faraway Bob", "Nonexistent"],
      },
    });

    const result = await narrate({
      client,
      state: world(),
      recentChat: chat,
      playerLine: "I draw my axe.",
      mode: "action",
    });

    expect(result.text).toBe("Snik hisses as your axe clears its sheath.");
    // Off-scene + unknown names are dropped; only the present entity survives.
    expect(result.mentions).toEqual(["Snik"]);
  });

  it("passes the scene + present entities + player line to the model", async () => {
    const client = createFakeLlmClient({
      input: { narration: "The cave swallows your words." },
    });

    await narrate({
      client,
      state: world(),
      recentChat: chat,
      playerLine: "Anyone there?",
      mode: "speak",
    });

    const prompt = client.calls[0]!.messages[0]!.content;
    expect(prompt).toContain("The Mossy Cave");
    expect(prompt).toContain("Thorin");
    expect(prompt).toContain("Snik");
    expect(prompt).toContain("Anyone there?");
    // Off-scene entities are not offered as mention candidates.
    expect(prompt).not.toContain("Faraway Bob");
  });

  it("throws when the model returns empty narration (caller falls back)", async () => {
    const client = createFakeLlmClient({ input: { narration: "   " } });
    await expect(
      narrate({
        client,
        state: world(),
        recentChat: chat,
        playerLine: "hi",
      }),
    ).rejects.toThrow();
  });

  it("yields no mentions when the world has no scene", async () => {
    const client = createFakeLlmClient({
      input: { narration: "Darkness.", mentions: ["Ghost"] },
    });
    const result = await narrate({
      client,
      state: undefined,
      recentChat: [],
      playerLine: "look around",
    });
    expect(result.mentions).toEqual([]);
  });

  it("injects an already-decided outcome the narration must honour", async () => {
    const client = createFakeLlmClient({ input: { narration: "You spot it." } });
    await narrate({
      client,
      state: world(),
      recentChat: chat,
      playerLine: "I search the wall",
      mode: "check",
      outcome: "Thorin's Wisdom (Perception) check succeeds (rolled 18 vs DC 12).",
    });
    const prompt = client.calls[0]!.messages[0]!.content;
    expect(prompt).toContain("already decided");
    expect(prompt).toContain("succeeds (rolled 18 vs DC 12)");
  });
});

describe("decideCheck", () => {
  it("returns the model's ability/skill/DC for a check attempt", async () => {
    const client = createFakeLlmClient({
      input: { ability: "dex", skill: "Stealth", dc: 15, proficient: true },
    });
    const decision = await decideCheck({
      client,
      state: world(),
      playerLine: "I sneak past the goblin",
    });
    expect(decision).toEqual({
      ability: "dex",
      skill: "Stealth",
      dc: 15,
      proficient: true,
    });
  });

  it("clamps a malformed DC and falls back to a valid ability", async () => {
    const client = createFakeLlmClient({
      input: { ability: "telekinesis", dc: 999 },
    });
    const decision = await decideCheck({
      client,
      state: world(),
      playerLine: "I do something",
    });
    expect(decision.ability).toBe("wis");
    expect(decision.dc).toBe(30);
    expect(decision.skill).toBeUndefined();
    expect(decision.proficient).toBe(false);
  });
});

describe("decideMonsterTarget", () => {
  const candidates = [
    { id: "hero", name: "Thorin", hp: 18 },
    { id: "mage", name: "Elara", hp: 6 },
  ];

  it("returns the model's chosen target when it's a legal candidate", async () => {
    const client = createFakeLlmClient({ input: { targetId: "mage" } });
    const chosen = await decideMonsterTarget({
      client,
      state: world(),
      monsterName: "Snik",
      candidates,
    });
    expect(chosen).toBe("mage");
  });

  it("ignores an out-of-set target id", async () => {
    const client = createFakeLlmClient({ input: { targetId: "dragon" } });
    const chosen = await decideMonsterTarget({
      client,
      state: world(),
      monsterName: "Snik",
      candidates,
    });
    expect(chosen).toBeUndefined();
  });

  it("offers the candidate list (id + hp) to the model", async () => {
    const client = createFakeLlmClient({ input: { targetId: "hero" } });
    await decideMonsterTarget({
      client,
      state: world(),
      monsterName: "Snik",
      candidates,
    });
    const prompt = client.calls[0]!.messages[0]!.content;
    expect(prompt).toContain("Thorin");
    expect(prompt).toContain("Elara");
    expect(prompt).toContain("6 HP");
  });
});

describe("narrateEnemyTurn", () => {
  it("frames the monster's turn and injects the resolved outcome", async () => {
    const client = createFakeLlmClient({
      input: { narration: "Snik's blade bites deep." },
    });
    const result = await narrateEnemyTurn({
      client,
      state: world(),
      recentChat: chat,
      actorName: "Snik",
      outcome: "Snik hits Thorin for 5 damage.",
    });
    expect(result.text).toBe("Snik's blade bites deep.");
    const prompt = client.calls[0]!.messages[0]!.content;
    expect(prompt).toContain("Snik's turn");
    expect(prompt).toContain("already decided");
    expect(prompt).toContain("hits Thorin for 5 damage");
  });
});

describe("activePlayerEntity", () => {
  it("picks the first character in the scene (goblins are excluded)", () => {
    const actor = activePlayerEntity(world());
    expect(actor?.name).toBe("Thorin");
  });

  it("returns undefined when there is no world", () => {
    expect(activePlayerEntity(undefined)).toBeUndefined();
  });
});
