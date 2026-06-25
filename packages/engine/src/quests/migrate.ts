import { createId } from "../id";
import type { QuestTemplate, QuestTrigger } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Default triggers for tracer / migrated quests on an entity. */
export function defaultTracerTriggers(
  locationEntityId?: string,
): QuestTrigger[] {
  return [
    {
      type: "on_session_start",
      delivery: "tease",
    },
    {
      type: "on_enter_location",
      delivery: "tease",
      config: locationEntityId ? { locationEntityId } : undefined,
    },
  ];
}

/** Convert one legacy hook string into a minimal quest template. */
export function migrateHookStringToTemplate(
  text: string,
  index: number,
  locationEntityId?: string,
): QuestTemplate {
  const trimmed = text.trim();
  const title = trimmed.slice(0, 120) || `Hook ${index + 1}`;
  return {
    id: createId(),
    title,
    teaseText: trimmed,
    description: trimmed,
    triggers: defaultTracerTriggers(locationEntityId),
    steps: [],
    source: "migrated",
  };
}

function normalizeQuestTemplate(
  raw: unknown,
  index: number,
  locationEntityId?: string,
): QuestTemplate | undefined {
  if (!isRecord(raw)) return undefined;
  const title = asString(raw.title);
  if (!title) return undefined;

  const id = asString(raw.id) ?? createId();
  const teaseText =
    asString(raw.teaseText) ??
    asString(raw.description) ??
    title;
  const triggers = Array.isArray(raw.triggers)
    ? (raw.triggers as QuestTrigger[])
    : defaultTracerTriggers(
        asString(raw.startingLocationEntityId) ?? locationEntityId,
      );

  const steps = Array.isArray(raw.steps)
    ? raw.steps
        .filter(isRecord)
        .map((step, stepIndex) => ({
          id: asString(step.id) ?? createId(),
          title: asString(step.title) ?? `Step ${stepIndex + 1}`,
          description: asString(step.description),
          gmInstructions: asString(step.gmInstructions),
        }))
    : [];

  return {
    id,
    title,
    description: asString(raw.description),
    tags: Array.isArray(raw.tags)
      ? raw.tags.filter((t): t is string => typeof t === "string")
      : undefined,
    teaseText,
    offerText: asString(raw.offerText),
    gmInstructions: asString(raw.gmInstructions),
    startingLocationEntityId: asString(raw.startingLocationEntityId),
    questGiverNpcEntityId: asString(raw.questGiverNpcEntityId),
    triggers,
    steps,
    source:
      raw.source === "generator" ||
      raw.source === "manual" ||
      raw.source === "migrated"
        ? raw.source
        : "manual",
  };
}

/**
 * Normalize `data.quests`, migrating legacy `data.hooks` strings when quests
 * are absent (Phase A auto-migrate on read).
 */
export function normalizeEntityQuests(
  data: unknown,
  locationEntityId?: string,
): QuestTemplate[] {
  if (!isRecord(data)) return [];

  const rawQuests = data.quests;
  if (Array.isArray(rawQuests) && rawQuests.length > 0) {
    return rawQuests
      .map((q, i) => normalizeQuestTemplate(q, i, locationEntityId))
      .filter((q): q is QuestTemplate => q !== undefined);
  }

  const hooks = data.hooks;
  if (!Array.isArray(hooks) || hooks.length === 0) return [];

  const migrated: QuestTemplate[] = [];
  for (let i = 0; i < hooks.length; i += 1) {
    const entry = hooks[i];
    if (typeof entry === "string" && entry.trim()) {
      migrated.push(migrateHookStringToTemplate(entry, i, locationEntityId));
      continue;
    }
    if (isRecord(entry)) {
      const title = asString(entry.title);
      const description = asString(entry.description);
      const combined = [title, description].filter(Boolean).join(": ");
      if (combined.trim()) {
        migrated.push(
          migrateHookStringToTemplate(combined, i, locationEntityId),
        );
      }
    }
  }
  return migrated;
}

function bindQuestsToLocation(
  quests: QuestTemplate[],
  locationEntityId: string,
): QuestTemplate[] {
  return quests.map((q) => ({
    ...q,
    startingLocationEntityId: q.startingLocationEntityId ?? locationEntityId,
    triggers: (q.triggers ?? defaultTracerTriggers(locationEntityId)).map(
      (t) =>
        t.type === "on_enter_location"
          ? {
              ...t,
              config: {
                ...t.config,
                locationEntityId:
                  t.config?.locationEntityId ?? locationEntityId,
              },
            }
          : t,
    ),
  }));
}

/** Merge normalized quests back into entity data; keeps legacy hooks in sync. */
export function enrichEntityDataWithQuests(
  data: Record<string, unknown>,
  locationEntityId?: string,
): Record<string, unknown> {
  let quests = normalizeEntityQuests(data, locationEntityId);
  if (quests.length === 0) return data;

  if (locationEntityId) {
    quests = bindQuestsToLocation(quests, locationEntityId);
  }

  const hooksFromQuests = quests
    .map((q) => q.teaseText ?? q.title)
    .filter(Boolean);
  const existingHooks = Array.isArray(data.hooks)
    ? data.hooks.filter(
        (h): h is string => typeof h === "string" && h.trim().length > 0,
      )
    : [];

  return {
    ...data,
    quests,
    hooks:
      existingHooks.length > 0
        ? existingHooks
        : hooksFromQuests.length > 0
          ? hooksFromQuests
          : data.hooks,
  };
}
