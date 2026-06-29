/**
 * Seed SRD 5.2 Exploration hazards overview + Rules Glossary entries (GRILL-EXPLORATION Slice 1).
 */
import { sql } from "drizzle-orm";

import type { Database } from "../client";
import { codexRuleChapters, codexRuleSections } from "../schema/codex";
import {
  EXPLORATION_HAZARD_GLOSSARY_SEEDS,
  EXPLORATION_HAZARDS_OVERVIEW_PROSE,
  EXPLORATION_HAZARDS_OVERVIEW_SLUG,
  PLAYING_THE_GAME_CHAPTER_SLUG,
  RULES_GLOSSARY_CHAPTER_SLUG,
} from "./srd-exploration-hazards";

export type SeedExplorationHazardsResult = {
  chaptersUpserted: number;
  overviewUpserted: boolean;
  glossaryUpserted: number;
};

export async function seedExplorationHazards(
  db: Database,
): Promise<SeedExplorationHazardsResult> {
  const chapterRows = [
    {
      slug: PLAYING_THE_GAME_CHAPTER_SLUG,
      name: "Playing the Game",
      description:
        "Core rules for playing Dungeons & Dragons, including exploration and social interaction.",
      sortIndex: 10,
      source: "srd",
      raw: { seeded: true, pdfSection: "Playing the Game" },
    },
    {
      slug: RULES_GLOSSARY_CHAPTER_SLUG,
      name: "Rules Glossary",
      description:
        "Alphabetical definitions of rules terms, including exploration hazards.",
      sortIndex: 20,
      source: "srd",
      raw: { seeded: true, pdfSection: "Rules Glossary" },
    },
  ] as const;

  for (const chapter of chapterRows) {
    await db
      .insert(codexRuleChapters)
      .values(chapter)
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
  }

  await db
    .insert(codexRuleSections)
    .values({
      slug: EXPLORATION_HAZARDS_OVERVIEW_SLUG,
      name: "Exploration Hazards",
      description: EXPLORATION_HAZARDS_OVERVIEW_PROSE,
      chapterSlug: PLAYING_THE_GAME_CHAPTER_SLUG,
      sortIndex: 50,
      source: "srd",
      raw: {
        seeded: true,
        kind: "exploration_hazards_overview",
        glossarySlugs: EXPLORATION_HAZARD_GLOSSARY_SEEDS.map((s) => s.slug),
      },
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

  let glossaryUpserted = 0;
  for (const seed of EXPLORATION_HAZARD_GLOSSARY_SEEDS) {
    await db
      .insert(codexRuleSections)
      .values({
        slug: seed.slug,
        name: seed.name,
        description: seed.description,
        chapterSlug: RULES_GLOSSARY_CHAPTER_SLUG,
        sortIndex: seed.sortIndex,
        source: "srd",
        raw: {
          seeded: true,
          kind: "exploration_hazard_glossary",
          overviewSlug: EXPLORATION_HAZARDS_OVERVIEW_SLUG,
        },
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
    glossaryUpserted += 1;
  }

  return {
    chaptersUpserted: chapterRows.length,
    overviewUpserted: true,
    glossaryUpserted,
  };
}
