import { describe, expect, it } from "vitest";

import {
  enrichEntityDataWithQuests,
  migrateHookStringToTemplate,
  normalizeEntityQuests,
} from "./migrate";
import { formatQuestTeaseLine, resolveQuestTeaseText } from "./triggers";

const TAVERN_ID = "11111111-1111-4111-8111-111111111111";

describe("normalizeEntityQuests", () => {
  it("migrates legacy hook strings", () => {
    const quests = normalizeEntityQuests(
      { hooks: ["The cellar door won't stay shut."] },
      TAVERN_ID,
    );
    expect(quests).toHaveLength(1);
    expect(quests[0]?.teaseText).toBe("The cellar door won't stay shut.");
    expect(quests[0]?.source).toBe("migrated");
  });

  it("prefers structured quests when present", () => {
    const quests = normalizeEntityQuests({
      quests: [
        {
          id: "q1",
          title: "Missing child",
          teaseText: "A boy vanished last night.",
          triggers: [{ type: "on_session_start", delivery: "tease" }],
        },
      ],
    });
    expect(quests[0]?.title).toBe("Missing child");
  });
});

describe("resolveQuestTeaseText", () => {
  it("fires on_session_start for migrated hooks", () => {
    const tease = resolveQuestTeaseText(
      { hooks: ["Someone stole the sign."] },
      "on_session_start",
      { locationEntityId: TAVERN_ID },
    );
    expect(tease).toBe("Someone stole the sign.");
  });

  it("respects on_enter_location config", () => {
    const tease = resolveQuestTeaseText(
      {
        quests: [
          {
            id: "q1",
            title: "Tavern trouble",
            teaseText: "A brawl is brewing.",
            triggers: [
              {
                type: "on_enter_location",
                delivery: "tease",
                config: { locationEntityId: TAVERN_ID },
              },
            ],
          },
        ],
      },
      "on_enter_location",
      { locationEntityId: TAVERN_ID },
    );
    expect(tease).toBe("A brawl is brewing.");
  });

  it("skips enter_location tease for other locations", () => {
    const tease = resolveQuestTeaseText(
      {
        quests: [
          {
            id: "q1",
            title: "Tavern trouble",
            teaseText: "A brawl is brewing.",
            triggers: [
              {
                type: "on_enter_location",
                delivery: "tease",
                config: { locationEntityId: TAVERN_ID },
              },
            ],
          },
        ],
      },
      "on_enter_location",
      { locationEntityId: "22222222-2222-4222-8222-222222222222" },
    );
    expect(tease).toBeUndefined();
  });
});

describe("enrichEntityDataWithQuests", () => {
  it("binds location entity id on persist", () => {
    const enriched = enrichEntityDataWithQuests(
      { hooks: ["Whispers in the well."] },
      TAVERN_ID,
    );
    const quests = enriched.quests as Array<{
      startingLocationEntityId?: string;
      triggers?: Array<{ config?: { locationEntityId?: string } }>;
    }>;
    expect(quests[0]?.startingLocationEntityId).toBe(TAVERN_ID);
    const enterTrigger = quests[0]?.triggers?.find(
      (t) => t.config?.locationEntityId === TAVERN_ID,
    );
    expect(enterTrigger).toBeDefined();
  });
});

describe("formatQuestTeaseLine", () => {
  it("wraps tease copy for GM narration", () => {
    expect(formatQuestTeaseLine("A rumor spreads")).toBe(
      "Word reaches you: A rumor spreads. ",
    );
  });
});

describe("migrateHookStringToTemplate", () => {
  it("creates tracer triggers", () => {
    const template = migrateHookStringToTemplate("Help!", 0, TAVERN_ID);
    expect(template.triggers?.some((t) => t.type === "on_session_start")).toBe(
      true,
    );
    expect(template.triggers?.some((t) => t.type === "on_enter_location")).toBe(
      true,
    );
  });
});
