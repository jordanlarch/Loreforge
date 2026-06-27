/**
 * Extract 2024 weapon mastery from Open5e item raw JSON (stored on codex_items).
 */
export type Open5eMastery = {
  property: string;
  description: string;
};

export function masteryFromOpen5eItemRaw(
  raw: Record<string, unknown>,
): Open5eMastery | null {
  const weapon = raw.weapon as
    | {
        properties?: {
          property?: { name?: string; type?: string | null; desc?: string };
        }[];
      }
    | null
    | undefined;
  if (!weapon?.properties?.length) return null;
  for (const entry of weapon.properties) {
    const prop = entry.property;
    if (prop?.type === "Mastery" && prop.name) {
      return {
        property: prop.name,
        description: prop.desc?.trim() || `${prop.name} mastery.`,
      };
    }
  }
  return null;
}
