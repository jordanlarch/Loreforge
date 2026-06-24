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

const LIVE: CodexCategory[] = [
  "Spells",
  "Species",
  "Classes",
  "Backgrounds",
  "Animals",
  "Monsters",
  "Items",
  "Feats",
];

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
    "SRD 2024 backgrounds from Open5e — ability scores, proficiencies, equipment, and origin feats.",
  Animals:
    "Beasts with CR 1 or lower from the SRD creature ingest.",
  Monsters:
    "Full SRD creature stat blocks from Open5e.",
  Items:
    "Adventuring gear, weapons, armor, and wondrous items from the Open5e SRD item ingest.",
  Feats:
    "SRD 2024 feats from Open5e — general, origin, fighting style, and epic boons.",
};
