import { describe, expect, it } from "vitest";

import {
  inheritQuestDataFromParent,
  locationHasQuestContent,
  resolveQuestTeaseTextWithInheritance,
} from "./inherit";

const TAVERN_ID = "11111111-1111-4111-8111-111111111111";
const REGION_ID = "22222222-2222-4222-8222-222222222222";

describe("locationHasQuestContent", () => {
  it("detects hooks and quests", () => {
    expect(locationHasQuestContent({ hooks: ["A rumor."] })).toBe(true);
    expect(locationHasQuestContent({ quests: [{ title: "Quest" }] })).toBe(
      true,
    );
    expect(locationHasQuestContent({})).toBe(false);
  });
});

describe("inheritQuestDataFromParent", () => {
  it("copies parent hooks onto an empty tavern stub", () => {
    const parent = { hooks: ["Travelers vanish on the river road."] };
    const inherited = inheritQuestDataFromParent(parent, TAVERN_ID, {});
    expect(Array.isArray(inherited.quests)).toBe(true);
    expect((inherited.quests as unknown[]).length).toBe(1);
    expect(inherited.hooks).toEqual(["Travelers vanish on the river road."]);
  });

  it("does not overwrite child quests", () => {
    const parent = { hooks: ["Parent hook"] };
    const child = {
      quests: [
        {
          title: "Tavern trouble",
          teaseText: "Local brawl.",
          triggers: [{ type: "on_session_start", delivery: "tease" }],
        },
      ],
    };
    expect(inheritQuestDataFromParent(parent, TAVERN_ID, child)).toEqual(child);
  });
});

describe("resolveQuestTeaseTextWithInheritance", () => {
  it("inherits session-start tease from parent region data", () => {
    const tease = resolveQuestTeaseTextWithInheritance(
      {},
      "on_session_start",
      { locationEntityId: TAVERN_ID },
      {
        hooks: ["Someone stole the sign."],
        startingLocationEntityId: REGION_ID,
      },
    );
    expect(tease).toBe("Someone stole the sign.");
  });
});
