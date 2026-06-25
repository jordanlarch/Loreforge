import { describe, expect, it } from "vitest";

import { buildQuestInstanceDataFromTemplate } from "./instance";
import {
  buildActiveQuestHotContext,
  formatQuestOfferLine,
  pendingQuestBriefings,
  playerTextReferencesNpc,
  resolveQuestOfferForNpc,
} from "./runtime";

const NPC_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const QUEST_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("resolveQuestOfferForNpc", () => {
  it("fires when player mentions the giver NPC", () => {
    const template = {
      id: "t1",
      title: "Missing daughter",
      offerText: "Please find my daughter.",
      questGiverNpcEntityId: NPC_ID,
      triggers: [{ type: "on_talk_to_npc" as const, delivery: "offer" as const }],
      steps: [],
    };
    const instances = [
      {
        id: QUEST_ID,
        status: "open",
        title: template.title,
        data: buildQuestInstanceDataFromTemplate(template),
      },
    ];
    const offer = resolveQuestOfferForNpc(
      instances,
      { entityId: NPC_ID, name: "Harold" },
      "I speak to Harold about the road.",
    );
    expect(offer?.offerText).toBe("Please find my daughter.");
  });

  it("ignores resolved quests", () => {
    const offer = resolveQuestOfferForNpc(
      [
        {
          id: QUEST_ID,
          status: "resolved",
          title: "Done",
          data: {},
        },
      ],
      { entityId: NPC_ID, name: "Harold" },
      "Hello Harold",
    );
    expect(offer).toBeUndefined();
  });
});

describe("pendingQuestBriefings", () => {
  it("returns active quests without briefing flag", () => {
    const template = {
      id: "t1",
      title: "Rescue",
      gmInstructions: "Keep tension high.",
      steps: [{ id: "s1", title: "Find the trail", gmInstructions: "Clues in mud." }],
    };
    const pending = pendingQuestBriefings([
      {
        id: QUEST_ID,
        status: "active",
        title: "Rescue",
        data: {
          templateSnapshot: template,
          currentStepId: "s1",
          briefingDelivered: false,
        },
      },
    ]);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.line).toContain("Rescue");
  });
});

describe("buildActiveQuestHotContext", () => {
  it("includes active step GM instructions", () => {
    const block = buildActiveQuestHotContext([
      {
        id: QUEST_ID,
        status: "active",
        title: "Rescue",
        data: {
          templateSnapshot: {
            id: "t1",
            title: "Rescue",
            gmInstructions: "Canon quest line.",
            steps: [{ id: "s1", title: "Search the woods", gmInstructions: "Three clues max." }],
          },
          currentStepId: "s1",
        },
      },
    ]);
    expect(block).toContain("Active quest: Rescue");
    expect(block).toContain("Search the woods");
  });
});

describe("formatQuestOfferLine", () => {
  it("wraps NPC dialogue", () => {
    expect(formatQuestOfferLine("Help me.", "Mira")).toContain("Mira leans in");
  });
});

describe("playerTextReferencesNpc", () => {
  it("matches substring names", () => {
    expect(playerTextReferencesNpc("I ask the barkeep Mira for ale", "Mira")).toBe(
      true,
    );
  });
});
