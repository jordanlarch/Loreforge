import type { QuestRewards, QuestTemplate } from "./types";

export type QuestRewardsGranted = {
  xpPerPc?: number;
  lootNotes?: string;
  reputationNotes?: string;
  grantedAt: string;
};

/** Read reward fields from a template snapshot. */
export function questRewardsFromTemplate(
  template: QuestTemplate | undefined,
): QuestRewards | undefined {
  if (!template?.rewards) return undefined;
  const { xp, lootNotes, reputationNotes } = template.rewards;
  if (
    (xp == null || xp <= 0) &&
    !lootNotes?.trim() &&
    !reputationNotes?.trim()
  ) {
    return undefined;
  }
  return template.rewards;
}

/** Build the grant record stored on the instance after Resolve. */
export function buildRewardsGranted(
  template: QuestTemplate | undefined,
): QuestRewardsGranted | undefined {
  const rewards = questRewardsFromTemplate(template);
  if (!rewards) return undefined;

  return {
    ...(rewards.xp != null && rewards.xp > 0
      ? { xpPerPc: rewards.xp }
      : {}),
    ...(rewards.lootNotes?.trim()
      ? { lootNotes: rewards.lootNotes.trim() }
      : {}),
    ...(rewards.reputationNotes?.trim()
      ? { reputationNotes: rewards.reputationNotes.trim() }
      : {}),
    grantedAt: new Date().toISOString(),
  };
}

/** Format rewards for a GM chat line on resolve. */
export function formatQuestResolveRewardsLine(
  granted: QuestRewardsGranted,
): string | undefined {
  const parts: string[] = [];
  if (granted.xpPerPc != null && granted.xpPerPc > 0) {
    parts.push(`${granted.xpPerPc} XP awarded to each party member`);
  }
  if (granted.lootNotes) parts.push(`Loot: ${granted.lootNotes}`);
  if (granted.reputationNotes) {
    parts.push(`Reputation: ${granted.reputationNotes}`);
  }
  if (parts.length === 0) return undefined;
  return `Quest rewards — ${parts.join("; ")}.`;
}
