/**
 * Declarative monster stat-block schema (DATA-1c design stub).
 * Full Codex bestiary bridge deferred — see `docs/deferrals.md` DATA-1c.
 */
export type MonsterDefinition = {
  id: string;
  name: string;
  size: string;
  creatureType: string;
  alignment?: string;
  ac: number;
  hp: number;
  speed: number;
  /** Ability scores — partial blocks allowed at tracer depth. */
  abilityScores?: Partial<
    Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>
  >;
  description: string;
};

export function monsterDefinitionId(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "monster"
  );
}

export function validateMonsterDefinition(def: MonsterDefinition): string[] {
  const errors: string[] = [];
  if (!def.name?.trim()) errors.push("Name is required.");
  if (!def.id?.trim()) errors.push("Monster id is required.");
  if (def.ac < 1 || def.ac > 40) errors.push("AC must be between 1 and 40.");
  if (def.hp < 1 || def.hp > 10000) errors.push("HP must be between 1 and 10000.");
  if (def.speed < 0 || def.speed > 200) errors.push("Speed must be between 0 and 200.");
  return errors;
}

export function isValidMonsterDefinition(def: MonsterDefinition): boolean {
  return validateMonsterDefinition(def).length === 0;
}
