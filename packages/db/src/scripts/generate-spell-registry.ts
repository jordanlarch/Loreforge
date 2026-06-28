/**
 * SRD-AUDIT-6: generate Open5e-derived spell registry entries from `codex_spells`.
 *
 * Run after spell ingest: `npm run generate:spell-registry` (from packages/db).
 * Hand-authored overrides in `spell-registry.ts` take precedence at merge time.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { sql } from "drizzle-orm";

import { open5eRawToSpellDefinition } from "../../../engine/src/content/open5e-spell";
import {
  validateSpellDefinition,
  type SpellDefinition,
} from "../../../engine/src/content/spells";

import { closeDb, getDb } from "../client";

const OUT_PATH = resolve(
  import.meta.dirname,
  "../../../engine/src/content/spell-registry-open5e.generated.ts",
);

function catalogStub(
  slug: string,
  name: string,
  description: string,
): SpellDefinition {
  return {
    id: slug.replace(/\//g, "-").toLowerCase(),
    name,
    level: 0,
    school: "evocation",
    classes: [],
    castingTime: { unit: "action", amount: 1 },
    range: { type: "self" },
    components: { verbal: true, somatic: true },
    duration: { unit: "instantaneous" },
    concentration: false,
    ritual: false,
    targeting: "self",
    description:
      description.trim() ||
      `${name} — catalog entry from the SRD; combat resolution not yet authored.`,
  };
}

async function main() {
  const db = getDb();
  const rows = await db.execute<{
    slug: string;
    name: string;
    raw: Record<string, unknown>;
  }>(
    sql`SELECT slug, name, raw
        FROM codex_spells
        WHERE (raw->'document'->>'key') = 'srd-2024'
        ORDER BY name`,
  );

  const registry: Record<string, SpellDefinition> = {};
  let converted = 0;
  let stubbed = 0;

  for (const row of rows) {
    const raw = row.raw ?? {};
    let def = open5eRawToSpellDefinition(raw, {
      slug: row.slug,
      name: row.name,
    });
    const errors = validateSpellDefinition(def);
    if (errors.length > 0) {
      def = catalogStub(
        row.slug,
        row.name,
        String(raw.desc ?? raw.description ?? ""),
      );
      stubbed += 1;
    } else {
      converted += 1;
    }
    if (def.id !== def.id.trim()) continue;
    registry[def.id] = def;
  }

  const body = `/**
 * AUTO-GENERATED — do not edit by hand.
 * Source: codex_spells (Open5e srd-2024). Regenerate with:
 *   npm run generate:spell-registry
 * @see packages/db/src/scripts/generate-spell-registry.ts
 */
import type { SpellDefinition } from "./spells";

export const OPEN5E_SPELL_REGISTRY: Record<string, SpellDefinition> = ${JSON.stringify(registry, null, 2)} as Record<string, SpellDefinition>;
`;

  writeFileSync(OUT_PATH, body, "utf8");
  console.log(
    `[generate:spell-registry] Wrote ${Object.keys(registry).length} spell(s) ` +
      `(${converted} converted, ${stubbed} catalog stubs) → ${OUT_PATH}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
