/**
 * Seed SRD 5.2 Gameplay Toolbox curse/contagion entries + rules section (DATA-1b).
 */
import { sql } from "drizzle-orm";

import { validateCurseDefinition } from "@app/engine";

import type { Database } from "../client";
import {
  codexRuleChapters,
  codexRuleSections,
  codexToolboxEntries,
} from "../schema/codex";
import { GAMEPLAY_TOOLBOX_CHAPTER_SLUG } from "./srd-toolbox-shared";
import {
  CURSES_RULES_PROSE,
  CURSES_RULES_SECTION_SLUG,
  SRD_TOOLBOX_CURSE_SEEDS,
} from "./srd-toolbox-curses";

export type SeedToolboxCursesResult = {
  chapterUpserted: boolean;
  rulesSectionUpserted: boolean;
  cursesUpserted: number;
};

export async function seedToolboxCurses(
  db: Database,
): Promise<SeedToolboxCursesResult> {
  for (const seed of SRD_TOOLBOX_CURSE_SEEDS) {
    const errors = validateCurseDefinition(seed.definition);
    if (errors.length > 0) {
      throw new Error(`Invalid curse seed ${seed.slug}: ${errors.join(" ")}`);
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
      slug: CURSES_RULES_SECTION_SLUG,
      name: "Curses and Magical Contagions",
      description: CURSES_RULES_PROSE,
      chapterSlug: GAMEPLAY_TOOLBOX_CHAPTER_SLUG,
      sortIndex: 2,
      source: "srd",
      raw: { seeded: true, topic: "curse" },
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

  let cursesUpserted = 0;
  for (const seed of SRD_TOOLBOX_CURSE_SEEDS) {
    await db
      .insert(codexToolboxEntries)
      .values({
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        topic: "curse",
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
    cursesUpserted += 1;
  }

  return {
    chapterUpserted: true,
    rulesSectionUpserted: true,
    cursesUpserted,
  };
}
