import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import {
  open5eRawToSpellDefinition,
  validateSpellDefinition,
  type ItemType,
} from "@app/engine";
import {
  codexBackgrounds,
  codexClasses,
  codexFeats,
  codexItems,
  codexMonsters,
  codexRuleSections,
  codexSpecies,
  codexSpells,
  getDb,
  homebrewItems,
  homebrewSpells,
} from "@app/db";

import { CODEX_CATEGORIES, type CodexCategory } from "@/lib/codex-categories";
import { weaponPropertyEntries } from "@/lib/codex-item-display";
import {
  formatChallengeRating,
  formatCreatureType,
  formatSize,
  formatSpeedLine,
} from "@/lib/codex-monster-display";
import {
  buildCodexSnapshotDescription,
  codexCategorySnapshotType,
  codexSmithyCopyKey,
  open5eItemCategoryToType,
} from "@/lib/codex-to-smithy";

export const codexCopyCategory = CODEX_CATEGORIES;

export type CopyFromCodexResult =
  | { kind: "spell"; id: string }
  | { kind: "item"; id: string };

async function findOwnedSnapshotItem(ownerId: string, copyKey: string) {
  const db = getDb();
  const [existing] = await db
    .select({ id: homebrewItems.id })
    .from(homebrewItems)
    .where(
      and(
        eq(homebrewItems.ownerId, ownerId),
        eq(homebrewItems.copiedFromSlug, copyKey),
      ),
    )
    .limit(1);
  return existing ?? null;
}

async function insertSnapshotItem(input: {
  ownerId: string;
  name: string;
  type: ItemType;
  description: string;
  properties: string[];
  copyKey: string;
  requiresAttunement?: boolean;
}): Promise<{ kind: "item"; id: string }> {
  const db = getDb();
  const [row] = await db
    .insert(homebrewItems)
    .values({
      ownerId: input.ownerId,
      name: input.name,
      type: input.type,
      description: input.description,
      properties: input.properties,
      requiresAttunement: input.requiresAttunement ?? false,
      source: "codex",
      copiedFromSlug: input.copyKey,
    })
    .returning({ id: homebrewItems.id });
  return { kind: "item", id: row!.id };
}

async function copySpell(ownerId: string, slug: string): Promise<CopyFromCodexResult> {
  const db = getDb();
  const [existing] = await db
    .select({ id: homebrewSpells.id })
    .from(homebrewSpells)
    .where(
      and(
        eq(homebrewSpells.ownerId, ownerId),
        eq(homebrewSpells.copiedFromSlug, slug),
      ),
    )
    .limit(1);
  if (existing) return { kind: "spell", id: existing.id };

  const [codex] = await db
    .select()
    .from(codexSpells)
    .where(eq(codexSpells.slug, slug))
    .limit(1);
  if (!codex) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Codex spell not found." });
  }

  const definition = open5eRawToSpellDefinition(codex.raw, {
    slug: codex.slug,
    name: codex.name,
  });
  const errors = validateSpellDefinition(definition);
  if (errors.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `This spell could not be converted automatically: ${errors.join(" ")}`,
    });
  }

  const [row] = await db
    .insert(homebrewSpells)
    .values({
      ownerId,
      name: definition.name,
      level: definition.level,
      school: definition.school,
      description: definition.description,
      definition,
      source: "codex",
      copiedFromSlug: slug,
    })
    .returning({ id: homebrewSpells.id });
  return { kind: "spell", id: row!.id };
}

async function copyItem(ownerId: string, slug: string): Promise<CopyFromCodexResult> {
  const existing = await findOwnedSnapshotItem(ownerId, slug);
  if (existing) return { kind: "item", id: existing.id };

  const db = getDb();
  const [codex] = await db
    .select()
    .from(codexItems)
    .where(eq(codexItems.slug, slug))
    .limit(1);
  if (!codex) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Codex item not found." });
  }

  const raw = codex.raw ?? {};
  const properties = weaponPropertyEntries(raw).map((p) => p.name);
  const description =
    codex.description?.trim() ||
    buildCodexSnapshotDescription({
      category: "Items",
      name: codex.name,
      raw,
    });

  return insertSnapshotItem({
    ownerId,
    name: codex.name,
    type: open5eItemCategoryToType(codex.category),
    description,
    properties,
    copyKey: slug,
    requiresAttunement: Boolean(raw.requires_attunement),
  });
}

async function copySnapshot(
  ownerId: string,
  category: CodexCategory,
  slug: string,
): Promise<CopyFromCodexResult> {
  const copyKey = codexSmithyCopyKey(category, slug);
  const existing = await findOwnedSnapshotItem(ownerId, copyKey);
  if (existing) return { kind: "item", id: existing.id };

  const db = getDb();
  const type = codexCategorySnapshotType(category);

  if (category === "Species") {
    const [row] = await db
      .select()
      .from(codexSpecies)
      .where(eq(codexSpecies.slug, slug))
      .limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Codex entry not found." });
    return insertSnapshotItem({
      ownerId,
      name: row.name,
      type,
      properties: [`Codex: ${category}`, ...row.traits.slice(0, 8)],
      copyKey,
      description: buildCodexSnapshotDescription({
        category,
        name: row.name,
        description: row.description,
        raw: row.raw,
        extras: [
          `${row.size} · ${row.speed} ft speed`,
          `Ability bonuses: ${JSON.stringify(row.abilityBonuses)}`,
          row.traits.length ? `Traits: ${row.traits.join(", ")}` : "",
        ],
      }),
    });
  }

  if (category === "Classes") {
    const [row] = await db
      .select()
      .from(codexClasses)
      .where(eq(codexClasses.slug, slug))
      .limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Codex entry not found." });
    return insertSnapshotItem({
      ownerId,
      name: row.name,
      type,
      properties: [`Codex: ${category}`, `Hit die d${row.hitDie}`],
      copyKey,
      description: buildCodexSnapshotDescription({
        category,
        name: row.name,
        description: row.description,
        raw: row.raw,
        extras: [
          `Saving throws: ${row.savingThrows.join(", ") || "—"}`,
          `Skill choice: ${row.skillChoice.choose} from list`,
        ],
      }),
    });
  }

  if (category === "Backgrounds") {
    const [row] = await db
      .select()
      .from(codexBackgrounds)
      .where(eq(codexBackgrounds.slug, slug))
      .limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Codex entry not found." });
    return insertSnapshotItem({
      ownerId,
      name: row.name,
      type,
      properties: [`Codex: ${category}`],
      copyKey,
      description: buildCodexSnapshotDescription({
        category,
        name: row.name,
        description: row.description,
        raw: row.raw,
      }),
    });
  }

  if (category === "Feats") {
    const [row] = await db
      .select()
      .from(codexFeats)
      .where(eq(codexFeats.slug, slug))
      .limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Codex entry not found." });
    return insertSnapshotItem({
      ownerId,
      name: row.name,
      type,
      properties: [
        `Codex: ${category}`,
        row.featType ? `Type: ${row.featType}` : "",
      ].filter(Boolean),
      copyKey,
      description: buildCodexSnapshotDescription({
        category,
        name: row.name,
        description: row.description,
        raw: row.raw,
        extras: row.prerequisite ? [`Prerequisite: ${row.prerequisite}`] : [],
      }),
    });
  }

  if (category === "Animals" || category === "Monsters") {
    const [row] = await db
      .select()
      .from(codexMonsters)
      .where(eq(codexMonsters.slug, slug))
      .limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Codex entry not found." });
    const raw = row.raw ?? {};
    return insertSnapshotItem({
      ownerId,
      name: row.name,
      type,
      properties: [
        `Codex: ${category}`,
        row.creatureType ?? "",
        row.challengeRating != null
          ? `CR ${formatChallengeRating(row.challengeRating)}`
          : "",
      ].filter(Boolean),
      copyKey,
      description: buildCodexSnapshotDescription({
        category,
        name: row.name,
        raw,
        extras: [
          `${formatSize(row.size)} ${formatCreatureType(row.creatureType)}`,
          `AC ${row.armorClass ?? "—"} · HP ${row.hitPoints ?? "—"}`,
          `Speed: ${formatSpeedLine(raw)}`,
          row.alignment ? `Alignment: ${row.alignment}` : "",
        ],
      }),
    });
  }

  if (category === "Rules") {
    const [row] = await db
      .select()
      .from(codexRuleSections)
      .where(eq(codexRuleSections.slug, slug))
      .limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Codex entry not found." });
    return insertSnapshotItem({
      ownerId,
      name: row.name,
      type,
      properties: [`Codex: ${category}`],
      copyKey,
      description: buildCodexSnapshotDescription({
        category,
        name: row.name,
        description: row.description,
        raw: row.raw,
      }),
    });
  }

  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `Copy to Smithy is not supported for ${category}.`,
  });
}

export async function copyCodexEntryToSmithy(input: {
  ownerId: string;
  category: CodexCategory;
  slug: string;
}): Promise<CopyFromCodexResult> {
  if (input.category === "Spells") {
    return copySpell(input.ownerId, input.slug);
  }
  if (input.category === "Items") {
    return copyItem(input.ownerId, input.slug);
  }
  if (input.category === "Advanced") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Advanced rules are not available to copy yet.",
    });
  }
  return copySnapshot(input.ownerId, input.category, input.slug);
}
