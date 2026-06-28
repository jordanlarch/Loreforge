import type { ToolboxTopic } from "@app/engine";

export const TOOLBOX_TOPIC_LABELS: Record<ToolboxTopic, string> = {
  trap: "Traps",
  poison: "Poisons",
  curse: "Curses and Magical Contagions",
  environmental_effect: "Environmental Effects",
  fear_stress: "Fear and Mental Stress",
};

export function formatToolboxTopic(topic: string | null | undefined): string {
  if (!topic) return "Gameplay Toolbox";
  return TOOLBOX_TOPIC_LABELS[topic as ToolboxTopic] ?? topic;
}

/** Legacy advanced ingest topic → toolbox topic where they align. */
export const LEGACY_ADVANCED_TOPIC_TO_TOOLBOX: Record<string, ToolboxTopic> = {
  traps: "trap",
  poisons: "poison",
  curses: "curse",
  environment: "environmental_effect",
  fear: "fear_stress",
};
