/** Quest trigger types shipped in Phase A runtime. */
export const QUEST_TRIGGER_TYPES = [
  "on_session_start",
  "on_enter_location",
  "on_talk_to_npc",
  "on_quest_accept",
] as const;

export type QuestTriggerType = (typeof QUEST_TRIGGER_TYPES)[number];

export type QuestDelivery = "tease" | "offer" | "briefing";

export type QuestTrigger = {
  type: QuestTriggerType;
  delivery: QuestDelivery;
  config?: {
    locationEntityId?: string;
    npcEntityId?: string;
  };
};

export type QuestStep = {
  id: string;
  title: string;
  description?: string;
  gmInstructions?: string;
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
  startingLocationEntityId?: string;
  questGiverNpcEntityId?: string;
  triggers?: QuestTrigger[];
  steps?: QuestStep[];
  source?: "generator" | "manual" | "migrated";
};

export type QuestTeaseTrigger = "on_session_start" | "on_enter_location";
