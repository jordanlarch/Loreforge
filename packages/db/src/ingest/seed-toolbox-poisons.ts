/**
 * Seed SRD 5.2 Gameplay Toolbox poison entries + rules section (DATA-1b).
 */
import { sql } from "drizzle-orm";

import { validatePoisonDefinition } from "@app/engine";

import type { Database } from "../client";
import {
  codexRuleChapters,
  codexRuleSections,
  codexToolboxEntries,
} from "../schema/codex";
import { GAMEPLAY_TOOLBOX_CHAPTER_SLUG } from "./srd-toolbox-shared";
import {
  POISONS_RULES_PROSE,
  POISONS_RULES_SECTION_SLUG,
  SRD_TOOLBOX_POISON_SEEDS,
} from "./srd-toolbox-poisons";

export type SeedToolboxPoisonsResult = {
  chapterUpserted: boolean;
  rulesSectionUpserted: boolean;
  poisonsUpserted: number;
};

export async function seedToolboxPoisons(
  db: Database,
): Promise<SeedToolboxPoisonsResult> {
  for (const seed of SRD_TOOLBOX_POISON_SEEDS) {
    const errors = validatePoisonDefinition(seed.definition);
    if (errors.length > 0) {
      throw new Error(`Invalid poison seed ${seed.slug}: ${errors.join(" ")}`);
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
      slug: POISONS_RULES_SECTION_SLUG,
      name: "Poisons",
      description: POISONS_RULES_PROSE,
      chapterSlug: GAMEPLAY_TOOLBOX_CHAPTER_SLUG,
      sortIndex: 1,
      source: "srd",
      raw: { seeded: true, topic: "poison" },
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

  let poisonsUpserted = 0;
  for (const seed of SRD_TOOLBOX_POISON_SEEDS) {
    await db
      .insert(codexToolboxEntries)
      .values({
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        topic: "poison",
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
    poisonsUpserted += 1;
  }

  return {
    chapterUpserted: true,
    rulesSectionUpserted: true,
    poisonsUpserted,
  };
}
