/**
 * Seed SRD 5.2 Gameplay Toolbox environmental effect entries + rules section (DATA-1b).
 */
import { sql } from "drizzle-orm";

import { validateEnvironmentalEffectDefinition } from "@app/engine";

import type { Database } from "../client";
import {
  codexRuleChapters,
  codexRuleSections,
  codexToolboxEntries,
} from "../schema/codex";
import { GAMEPLAY_TOOLBOX_CHAPTER_SLUG } from "./srd-toolbox-shared";
import {
  ENVIRONMENTAL_EFFECTS_RULES_PROSE,
  ENVIRONMENTAL_EFFECTS_RULES_SECTION_SLUG,
  SRD_TOOLBOX_ENVIRONMENTAL_EFFECT_SEEDS,
} from "./srd-toolbox-environmental-effects";

export type SeedToolboxEnvironmentalEffectsResult = {
  chapterUpserted: boolean;
  rulesSectionUpserted: boolean;
  environmentalEffectsUpserted: number;
};

export async function seedToolboxEnvironmentalEffects(
  db: Database,
): Promise<SeedToolboxEnvironmentalEffectsResult> {
  for (const seed of SRD_TOOLBOX_ENVIRONMENTAL_EFFECT_SEEDS) {
    const errors = validateEnvironmentalEffectDefinition(seed.definition);
    if (errors.length > 0) {
      throw new Error(
        `Invalid environmental effect seed ${seed.slug}: ${errors.join(" ")}`,
      );
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
      slug: ENVIRONMENTAL_EFFECTS_RULES_SECTION_SLUG,
      name: "Environmental Effects",
      description: ENVIRONMENTAL_EFFECTS_RULES_PROSE,
      chapterSlug: GAMEPLAY_TOOLBOX_CHAPTER_SLUG,
      sortIndex: 3,
      source: "srd",
      raw: { seeded: true, topic: "environmental_effect" },
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

  let environmentalEffectsUpserted = 0;
  for (const seed of SRD_TOOLBOX_ENVIRONMENTAL_EFFECT_SEEDS) {
    await db
      .insert(codexToolboxEntries)
      .values({
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        topic: "environmental_effect",
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
    environmentalEffectsUpserted += 1;
  }

  return {
    chapterUpserted: true,
    rulesSectionUpserted: true,
    environmentalEffectsUpserted,
  };
}
