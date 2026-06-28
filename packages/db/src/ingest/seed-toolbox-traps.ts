/**
 * Seed SRD 5.2 Gameplay Toolbox trap entries + rules section (DATA-1b v1).
 */
import { sql } from "drizzle-orm";

import { validateTrapDefinition } from "@app/engine";

import type { Database } from "../client";
import {
  codexRuleChapters,
  codexRuleSections,
  codexToolboxEntries,
} from "../schema/codex";
import {
  GAMEPLAY_TOOLBOX_CHAPTER_SLUG,
  SRD_TOOLBOX_TRAP_SEEDS,
  TRAPS_RULES_PROSE,
  TRAPS_RULES_SECTION_SLUG,
} from "../ingest/srd-toolbox-traps";

export type SeedToolboxTrapsResult = {
  chapterUpserted: boolean;
  rulesSectionUpserted: boolean;
  trapsUpserted: number;
};

export async function seedToolboxTraps(db: Database): Promise<SeedToolboxTrapsResult> {
  for (const seed of SRD_TOOLBOX_TRAP_SEEDS) {
    const errors = validateTrapDefinition(seed.definition);
    if (errors.length > 0) {
      throw new Error(`Invalid trap seed ${seed.slug}: ${errors.join(" ")}`);
    }
  }

  await db
    .insert(codexRuleChapters)
    .values({
      slug: GAMEPLAY_TOOLBOX_CHAPTER_SLUG,
      name: "Gameplay Toolbox",
      description: "Optional rules for traps, poisons, and other hazards.",
      sortIndex: 90,
      source: "srd",
      raw: { seeded: true },
    })
    .onConflictDoUpdate({
      target: codexRuleChapters.slug,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        sortIndex: sql`excluded.sort_index`,
        source: sql`excluded.source`,
        raw: sql`excluded.raw`,
        ingestedAt: sql`now()`,
      },
    });

  await db
    .insert(codexRuleSections)
    .values({
      slug: TRAPS_RULES_SECTION_SLUG,
      name: "Traps",
      description: TRAPS_RULES_PROSE,
      chapterSlug: GAMEPLAY_TOOLBOX_CHAPTER_SLUG,
      sortIndex: 0,
      source: "srd",
      raw: { seeded: true, topic: "trap" },
    })
    .onConflictDoUpdate({
      target: codexRuleSections.slug,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        chapterSlug: sql`excluded.chapter_slug`,
        sortIndex: sql`excluded.sort_index`,
        source: sql`excluded.source`,
        raw: sql`excluded.raw`,
        ingestedAt: sql`now()`,
      },
    });

  let trapsUpserted = 0;
  for (const seed of SRD_TOOLBOX_TRAP_SEEDS) {
    await db
      .insert(codexToolboxEntries)
      .values({
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        topic: "trap",
        sortIndex: seed.sortIndex,
        source: "srd",
        definition: seed.definition,
        raw: { seeded: true },
      })
      .onConflictDoUpdate({
        target: codexToolboxEntries.slug,
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          topic: sql`excluded.topic`,
          sortIndex: sql`excluded.sort_index`,
          source: sql`excluded.source`,
          definition: sql`excluded.definition`,
          raw: sql`excluded.raw`,
          ingestedAt: sql`now()`,
        },
      });
    trapsUpserted += 1;
  }

  return {
    chapterUpserted: true,
    rulesSectionUpserted: true,
    trapsUpserted,
  };
}
