/** Codex category navigation — spells/species/classes are live; rest await ingest. */
export const CODEX_CATEGORIES = [
  "Spells",
  "Species",
  "Classes",
  "Rules",
  "Backgrounds",
  "Animals",
  "Monsters",
  "Items",
  "Feats",
] as const;

export type CodexCategory = (typeof CODEX_CATEGORIES)[number];

const LIVE: CodexCategory[] = ["Spells", "Species", "Classes"];

export function isLiveCodexCategory(cat: CodexCategory): boolean {
  return LIVE.includes(cat);
}

export function parseCodexCategory(value: string | null | undefined): CodexCategory {
  if (value && (CODEX_CATEGORIES as readonly string[]).includes(value)) {
    return value as CodexCategory;
  }
  return "Spells";
}

export const COMING_SOON_COPY: Partial<Record<CodexCategory, string>> = {
  Rules:
    "Core SRD rules chapters (combat, spellcasting, equipment) will land when the rules ingest pipeline is built.",
  Backgrounds:
    "SRD backgrounds are not ingested yet — the Creation Wizard skips background selection in v1.",
  Animals:
    "Beasts and mounts will come from the Open5e monster ingest (CR 0–1 filter).",
  Monsters:
    "Monster stat blocks await the normalized creature ingest pipeline.",
  Items:
    "Adventuring gear and magic items await structured equipment ingest.",
  Feats:
    "SRD feats will ship with the feats ingest pass.",
};
