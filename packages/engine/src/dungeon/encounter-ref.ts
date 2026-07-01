/**
 * DUN-10 — resolve dungeon room / wanderer encounters to engine monster templates.
 */
import { monsterTemplate } from "../content/monsters";

export type DungeonEncounterRef = {
  codexSlug: string;
  count: number;
};

function readRoomRaw(data: unknown, roomIndex: number): Record<string, unknown> | undefined {
  if (!data || typeof data !== "object") return undefined;
  const rooms = (data as Record<string, unknown>).rooms;
  if (!Array.isArray(rooms)) return undefined;
  const room = rooms[roomIndex];
  if (!room || typeof room !== "object") return undefined;
  return room as Record<string, unknown>;
}

function parseCount(raw: unknown, fallback = 2): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.min(20, Math.max(1, Math.floor(raw)));
  }
  return fallback;
}

/** Map a Codex creature slug to a curated {@link monsterTemplate} key when possible. */
export function codexSlugToMonsterTemplate(slug: string): string | undefined {
  const trimmed = slug.trim();
  if (!trimmed) return undefined;
  if (monsterTemplate(trimmed)) return trimmed;
  const bare = trimmed.replace(/^srd-2024_/, "");
  if (monsterTemplate(bare)) return bare;
  const lastSegment = bare.split("_").pop() ?? bare;
  if (monsterTemplate(lastSegment)) return lastSegment;
  return undefined;
}

/** Parse free-text encounter labels (legacy generator output). */
export function monsterTemplateFromLabel(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes("goblin")) return "goblin";
  if (lower.includes("wolf")) return "wolf";
  if (lower.includes("orc")) return "orc";
  if (lower.includes("skeleton")) return "skeleton";
  if (lower.includes("bandit")) return "bandit";
  if (lower.includes("ogre")) return "ogre";
  if (lower.includes("cultist")) return "cultist";
  return "skeleton";
}

export function countFromLabel(label: string | undefined, fallback = 2): number {
  const match = label?.match(/\b(\d+)\b/);
  if (!match) return fallback;
  return Math.min(20, Math.max(1, Number(match[1])));
}

/** Read an authored Codex encounter ref from a room row, if present. */
export function roomEncounterRef(
  data: unknown,
  roomIndex: number,
): DungeonEncounterRef | undefined {
  const room = readRoomRaw(data, roomIndex);
  if (!room) return undefined;
  const slug =
    typeof room.encounterCodexSlug === "string" ? room.encounterCodexSlug.trim() : "";
  if (!slug) return undefined;
  return {
    codexSlug: slug,
    count: parseCount(room.encounterCount),
  };
}

/** Resolve template slug + count for a dungeon room encounter (Codex ref wins over prose). */
export function resolveRoomEncounterTemplate(
  data: unknown,
  roomIndex: number,
): { template: string; count: number; label?: string } | undefined {
  const room = readRoomRaw(data, roomIndex);
  const label =
    typeof room?.encounter === "string" && room.encounter.trim()
      ? room.encounter.trim()
      : undefined;
  const ref = roomEncounterRef(data, roomIndex);
  if (ref) {
    const template = codexSlugToMonsterTemplate(ref.codexSlug) ?? monsterTemplateFromLabel(label ?? ref.codexSlug);
    return { template, count: ref.count, label };
  }
  if (label) {
    return {
      template: monsterTemplateFromLabel(label),
      count: countFromLabel(label),
      label,
    };
  }
  return undefined;
}

/** First wandering monster ref (legacy string list or structured group rows). */
export function firstWanderingMonsterRef(
  data: unknown,
): DungeonEncounterRef | undefined {
  if (!data || typeof data !== "object") return undefined;
  const root = data as Record<string, unknown>;

  const entries = root.wanderingMonsterEntries;
  if (Array.isArray(entries) && entries.length > 0) {
    const row = entries[0];
    if (row && typeof row === "object") {
      const obj = row as Record<string, unknown>;
      const slug =
        typeof obj.codexSlug === "string" ? obj.codexSlug.trim() : "";
      if (slug) {
        return {
          codexSlug: slug,
          count: parseCount(obj.count, 1),
        };
      }
    }
  }

  const wanderers = root.wanderingMonsters;
  if (Array.isArray(wanderers) && wanderers.length > 0) {
    const first = wanderers[0];
    if (typeof first === "string" && first.trim()) {
      return { codexSlug: "", count: countFromLabel(first, 1) };
    }
  }
  return undefined;
}

export function resolveWanderingMonsterTemplate(
  data: unknown,
): { template: string; count: number; label?: string } | undefined {
  if (!data || typeof data !== "object") return undefined;
  const root = data as Record<string, unknown>;

  const entries = root.wanderingMonsterEntries;
  if (Array.isArray(entries) && entries.length > 0) {
    const row = entries[0];
    if (row && typeof row === "object") {
      const obj = row as Record<string, unknown>;
      const slug =
        typeof obj.codexSlug === "string" ? obj.codexSlug.trim() : "";
      const label =
        typeof obj.label === "string" && obj.label.trim() ? obj.label.trim() : undefined;
      if (slug) {
        const template =
          codexSlugToMonsterTemplate(slug) ?? monsterTemplateFromLabel(label ?? slug);
        return { template, count: parseCount(obj.count, 1), label };
      }
      if (label) {
        return {
          template: monsterTemplateFromLabel(label),
          count: countFromLabel(label, 1),
          label,
        };
      }
    }
  }

  const wanderers = root.wanderingMonsters;
  if (Array.isArray(wanderers) && wanderers.length > 0) {
    const label = String(wanderers[0] ?? "").trim();
    if (!label) return undefined;
    return {
      template: monsterTemplateFromLabel(label),
      count: countFromLabel(label, 1),
      label,
    };
  }
  return undefined;
}
