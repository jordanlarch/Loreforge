/**
 * Seed SRD 5.2 Gameplay Toolbox fear/stress entries + rules section (DATA-1b).
 */
import { sql } from "drizzle-orm";

import { validateFearStressDefinition } from "@app/engine";

import type { Database } from "../client";
import {
  codexRuleChapters,
  codexRuleSections,
  codexToolboxEntries,
} from "../schema/codex";
import { GAMEPLAY_TOOLBOX_CHAPTER_SLUG } from "./srd-toolbox-shared";
import {
  FEAR_STRESS_RULES_PROSE,
  FEAR_STRESS_RULES_SECTION_SLUG,
  SRD_TOOLBOX_FEAR_STRESS_SEEDS,
} from "./srd-toolbox-fear-stress";

export type SeedToolboxFearStressResult = {
  chapterUpserted: boolean;
  rulesSectionUpserted: boolean;
  fearStressUpserted: number;
};

export async function seedToolboxFearStress(
  db: Database,
): Promise<SeedToolboxFearStressResult> {
  for (const seed of SRD_TOOLBOX_FEAR_STRESS_SEEDS) {
    const errors = validateFearStressDefinition(seed.definition);
    if (errors.length > 0) {
      throw new Error(
        `Invalid fear/stress seed ${seed.slug}: ${errors.join(" ")}`,
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
      slug: FEAR_STRESS_RULES_SECTION_SLUG,
      name: "Fear and Mental Stress",
      description: FEAR_STRESS_RULES_PROSE,
      chapterSlug: GAMEPLAY_TOOLBOX_CHAPTER_SLUG,
      sortIndex: 4,
      source: "srd",
      raw: { seeded: true, topic: "fear_stress" },
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

  let fearStressUpserted = 0;
  for (const seed of SRD_TOOLBOX_FEAR_STRESS_SEEDS) {
    await db
      .insert(codexToolboxEntries)
      .values({
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        topic: "fear_stress",
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
    fearStressUpserted += 1;
  }

  return {
    chapterUpserted: true,
    rulesSectionUpserted: true,
    fearStressUpserted,
  };
}
