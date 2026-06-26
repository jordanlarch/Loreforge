import { describe, expect, it } from "vitest";

import { evaluateQuestPrerequisites } from "./prerequisites";
import { advanceQuestStep } from "./steps";
import { buildRewardsGranted } from "./rewards";

describe("evaluateQuestPrerequisites", () => {
  it("blocks when party level is too low", () => {
    const result = evaluateQuestPrerequisites(
      { id: "q1", title: "Hard quest", minLevel: 5 },
      {
        partyMaxLevel: 3,
        resolvedSourceTemplateIds: new Set(),
        resolvedSnapshotTemplateIds: new Set(),
      },
    );
    expect(result.met).toBe(false);
  });

  it("passes when prerequisites are resolved", () => {
    const result = evaluateQuestPrerequisites(
      {
        id: "q2",
        title: "Follow-up",
        prerequisiteQuestTemplateIds: ["pre-1"],
      },
      {
        partyMaxLevel: 5,
        resolvedSourceTemplateIds: new Set(["pre-1"]),
        resolvedSnapshotTemplateIds: new Set(),
      },
    );
    expect(result.met).toBe(true);
  });
});

describe("advanceQuestStep", () => {
  it("advances linearly through steps", () => {
    const data = {
      templateSnapshot: {
        id: "t1",
        title: "Rescue",
        steps: [
          { id: "s1", title: "Find trail" },
          { id: "s2", title: "Reach camp" },
        ],
      },
      currentStepId: "s1",
      completedStepIds: [] as string[],
    };
    const result = advanceQuestStep(data, { stepId: "s1" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.currentStepId).toBe("s2");
      expect(result.data.completedStepIds).toContain("s1");
      expect(result.completed).toBe(false);
    }
  });

  it("requires branch choice when alternates exist", () => {
    const data = {
      templateSnapshot: {
        id: "t1",
        title: "Fork",
        steps: [
          { id: "s1", title: "Choose", alternateNextStepIds: ["s2", "s3"] },
          { id: "s2", title: "Left" },
          { id: "s3", title: "Right" },
        ],
      },
      currentStepId: "s1",
      completedStepIds: [] as string[],
    };
    expect(advanceQuestStep(data).ok).toBe(false);
    const picked = advanceQuestStep(data, { branchStepId: "s3" });
    expect(picked.ok).toBe(true);
    if (picked.ok) {
      expect(picked.data.currentStepId).toBe("s3");
    }
  });
});

describe("buildRewardsGranted", () => {
  it("captures xp and notes", () => {
    const granted = buildRewardsGranted({
      id: "t1",
      title: "Bounty",
      rewards: { xp: 100, lootNotes: "50 gp" },
    });
    expect(granted?.xpPerPc).toBe(100);
    expect(granted?.lootNotes).toBe("50 gp");
  });
});
