import { describe, expect, it } from "vitest";

import { createFakeLlmClient } from "@app/llm";
import type { WorldState } from "@app/engine";

import { narrate } from "./narration.js";
import type { ChatEntry } from "./chat.js";

/** A minimal world: one scene with a goblin + a hero present. */
function world(): WorldState {
  return {
    campaignId: "c1",
    currentSceneId: "s1",
    scenes: { s1: { id: "s1", name: "The Mossy Cave", description: "Dripping dark." } },
    entities: {
      hero: { id: "hero", name: "Thorin", sceneId: "s1" },
      goblin: { id: "goblin", name: "Snik", sceneId: "s1" },
      offscreen: { id: "offscreen", name: "Faraway Bob", sceneId: "s2" },
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
});
