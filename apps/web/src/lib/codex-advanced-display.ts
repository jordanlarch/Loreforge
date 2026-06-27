import type { AdvancedRuleTopic } from "@app/db";

export const ADVANCED_TOPIC_LABELS: Record<AdvancedRuleTopic, string> = {
  traps: "Traps",
  poisons: "Poisons",
  curses: "Curses & Contagions",
  fear: "Fear & Mental Stress",
  environment: "Environmental Effects",
};

export function formatAdvancedTopic(topic: string | null | undefined): string {
  if (!topic) return "Advanced";
  return ADVANCED_TOPIC_LABELS[topic as AdvancedRuleTopic] ?? topic;
}
