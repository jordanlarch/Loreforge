/** Quest trigger types shipped in Phase A runtime. */
export const QUEST_TRIGGER_TYPES = [
  "on_session_start",
  "on_enter_location",
  "on_talk_to_npc",
  "on_quest_accept",
  "on_combat_end",
  "on_step_complete",
] as const;

export type QuestTriggerType = (typeof QUEST_TRIGGER_TYPES)[number];

export type QuestDelivery = "tease" | "offer" | "briefing";

export const QUEST_TAGS = [
  "mystery",
  "puzzle",
  "social",
  "investigation",
  "combat",
  "exploration",
  "horror",
  "political",
  "dungeon",
  "rescue",
  "heist",
] as const;

export type QuestTag = (typeof QUEST_TAGS)[number];

export type QuestTrigger = {
  type: QuestTriggerType;
  delivery: QuestDelivery;
  config?: {
    locationEntityId?: string;
    npcEntityId?: string;
  };
};

export type QuestRewards = {
  xp?: number;
  lootNotes?: string;
  reputationNotes?: string;
};

export const QUEST_STEP_COMPLETION_KINDS = [
  "enter_zone",
  "discover_zone",
  "interact",
  "defeat_encounter",
  "talk_npc",
  "detected_in_zone",
] as const;

export type QuestStepCompletionKind =
  (typeof QUEST_STEP_COMPLETION_KINDS)[number];

export type QuestStep = {
  id: string;
  title: string;
  description?: string;
  gmInstructions?: string;
  /** DUN-4 — engine event that completes this step (see dungeon-exploration.md Q25). */
  completionKind?: QuestStepCompletionKind;
  /** Zone-scoped step target (DUN-4). */
  dungeonEntityId?: string;
  zoneId?: string;
  objectId?: string;
  npcEntityId?: string;
  /** Phase D: optional encounter spawn hint. */
  encounterRef?: string;
  /** Phase D: explicit linear successor. */
  nextStepId?: string;
  /** Phase D: branch targets when multiple paths exist. */
  alternateNextStepIds?: string[];
};

/** Tracer-depth template embedded on Realms entities (`data.quests`). */
export type QuestTemplate = {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  teaseText?: string;
  offerText?: string;
  gmInstructions?: string;
  /** Hard gate — highest PC level in party must meet this. */
  minLevel?: number;
  /** Hard gate — template ids that must be Resolved in the campaign. */
  prerequisiteQuestTemplateIds?: string[];
  startingLocationEntityId?: string;
  questGiverNpcEntityId?: string;
  triggers?: QuestTrigger[];
  steps?: QuestStep[];
  /** Stored on template; engine grants on Resolve (Phase D). */
  rewards?: QuestRewards;
  source?: "generator" | "manual" | "migrated";
};

export type QuestTeaseTrigger = "on_session_start" | "on_enter_location";
