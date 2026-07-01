import { describe, expect, it } from "vitest";

import {
  pendingStepAdvanceLines,
  queueStepAdvanceLine,
  resolveQuestAdvancesOnCombatEnd,
  resolveQuestAdvancesOnEvent,
} from "./step-triggers";

const LOC_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NPC_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("resolveQuestAdvancesOnEvent", () => {
  it("advances on enter_location when on_step_complete matches", () => {
    const advances = resolveQuestAdvancesOnEvent(
      [
        {
          id: "hook:1",
          status: "active",
          title: "Reach the shrine",
          data: {
            templateSnapshot: {
              id: "t1",
              title: "Reach the shrine",
              triggers: [
                {
                  type: "on_step_complete",
                  delivery: "briefing",
                  config: { locationEntityId: LOC_ID },
                },
              ],
              steps: [
                { id: "s1", title: "Travel to the shrine" },
                { id: "s2", title: "Search the altar" },
              ],
            },
            currentStepId: "s1",
            completedStepIds: [],
          },
        },
      ],
      { kind: "enter_location", locationEntityId: LOC_ID },
    );
    expect(advances).toHaveLength(1);
    expect(advances[0]!.data.currentStepId).toBe("s2");
    expect(advances[0]!.line).toContain("Search the altar");
  });

  it("advances on talk_to_npc when on_step_complete matches", () => {
    const advances = resolveQuestAdvancesOnEvent(
      [
        {
          id: "hook:2",
          status: "active",
          title: "Report back",
          data: {
            templateSnapshot: {
              id: "t2",
              title: "Report back",
              triggers: [
                {
                  type: "on_step_complete",
                  delivery: "briefing",
                  config: { npcEntityId: NPC_ID },
                },
              ],
              steps: [
                { id: "s1", title: "Speak with the captain" },
                { id: "s2", title: "Collect your reward" },
              ],
            },
            currentStepId: "s1",
            completedStepIds: [],
          },
        },
      ],
      { kind: "talk_to_npc", npcEntityId: NPC_ID },
    );
    expect(advances).toHaveLength(1);
    expect(advances[0]!.data.currentStepId).toBe("s2");
  });

  it("ignores unrelated locations", () => {
    const advances = resolveQuestAdvancesOnEvent(
      [
        {
          id: "hook:3",
          status: "active",
          title: "Reach the shrine",
          data: {
            templateSnapshot: {
              id: "t3",
              title: "Reach the shrine",
              triggers: [
                {
                  type: "on_step_complete",
                  delivery: "briefing",
                  config: { locationEntityId: LOC_ID },
                },
              ],
              steps: [{ id: "s1", title: "Travel to the shrine" }],
            },
            currentStepId: "s1",
            completedStepIds: [],
          },
        },
      ],
      { kind: "enter_location", locationEntityId: "other-loc" },
    );
    expect(advances).toHaveLength(0);
  });
});

describe("resolveQuestAdvancesOnCombatEnd", () => {
  it("still advances combat-tagged quests", () => {
    const advances = resolveQuestAdvancesOnCombatEnd([
      {
        id: "hook:4",
        status: "active",
        title: "Clear the den",
        data: {
          templateSnapshot: {
            id: "t4",
            title: "Clear the den",
            tags: ["combat"],
            steps: [
              { id: "s1", title: "Defeat the bandits", encounterRef: "bandits" },
              { id: "s2", title: "Search the camp" },
            ],
          },
          currentStepId: "s1",
          completedStepIds: [],
        },
      },
    ]);
    expect(advances).toHaveLength(1);
    expect(advances[0]!.data.currentStepId).toBe("s2");
  });
});

describe("pendingStepAdvanceLines", () => {
  it("returns undelivered manual advance lines", () => {
    const pending = pendingStepAdvanceLines([
      {
        id: "hook:5",
        status: "active",
        title: "Rescue",
        data: queueStepAdvanceLine(
          { templateSnapshot: { id: "t5", title: "Rescue", steps: [] } },
          "Quest briefing — Rescue: Next objective.",
        ),
      },
    ]);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.line).toContain("Rescue");
  });
});
