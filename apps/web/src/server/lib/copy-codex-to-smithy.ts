import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import {
  buildBackgroundDefinition,
  buildFeatDefinition,
  buildItemDefinition,
  buildSubclassDefinition,
  itemDefinitionId,
  open5eRawToItemDefinition,
  open5eRawToSpellDefinition,
  validateGameplayToolboxEntryDefinition,
  validateItemDefinition,
  validateSpellDefinition,
  type ItemDefinition,
  type ItemOptionContent,
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
  codexSubclasses,
  codexToolboxEntries,
  getDb,
  homebrewItems,
  homebrewSpells,
  homebrewToolboxEntries,
} from "@app/db";

import { CODEX_CATEGORIES, type CodexCategory } from "@/lib/codex-categories";
import {
  backgroundFeatureEntries,
  backgroundOriginFeatName,
  backgroundSkillProficiencies,
  featBenefits,
} from "@/lib/codex-background-feat-display";
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
  | { kind: "item"; id: string }
  | { kind: "toolbox"; id: string };

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
  definition?: ItemDefinition;
}): Promise<{ kind: "item"; id: string }> {
  const db = getDb();
  const definition =
    input.definition ??
    buildItemDefinition({
      name: input.name,
      itemType: input.type,
      description: input.description,
    });
  const errors = validateItemDefinition(definition);
  if (errors.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: errors.join(" "),
    });
  }
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
      definition,
    })
    .returning({ id: homebrewItems.id });
  return { kind: "item", id: row!.id };
}

async function copyToolboxEntry(
  ownerId: string,
  slug: string,
): Promise<CopyFromCodexResult> {
  const db = getDb();
  const [existing] = await db
    .select({ id: homebrewToolboxEntries.id })
    .from(homebrewToolboxEntries)
    .where(
      and(
        eq(homebrewToolboxEntries.ownerId, ownerId),
        eq(homebrewToolboxEntries.copiedFromSlug, slug),
      ),
    )
    .limit(1);
  if (existing) return { kind: "toolbox", id: existing.id };

  const [codex] = await db
    .select()
    .from(codexToolboxEntries)
    .where(eq(codexToolboxEntries.slug, slug))
    .limit(1);
  if (!codex) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Codex toolbox entry not found.",
    });
  }

  const errors = validateGameplayToolboxEntryDefinition(codex.definition);
  if (errors.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: errors.join(" "),
    });
  }

  const [row] = await db
    .insert(homebrewToolboxEntries)
    .values({
      ownerId,
      name: codex.name,
      topic: codex.topic,
      description: codex.description ?? codex.definition.description ?? "",
      definition: codex.definition,
      source: "codex",
      copiedFromSlug: slug,
    })
    .returning({ id: homebrewToolboxEntries.id });
  return { kind: "toolbox", id: row!.id };
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
  const definition = open5eRawToItemDefinition(raw, {
    slug: codex.slug,
    name: codex.name,
    category: codex.category,
    description,
    itemType: open5eItemCategoryToType(codex.category),
    cost: codex.cost,
    weight: codex.weight,
    weightUnit: codex.weightUnit,
  });

  return insertSnapshotItem({
    ownerId,
    name: codex.name,
    type: open5eItemCategoryToType(codex.category),
    description,
    properties,
    copyKey: slug,
    requiresAttunement: Boolean(raw.requires_attunement),
    definition,
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
    const raw = row.raw ?? {};
    const description =
      row.description?.trim() ||
      buildCodexSnapshotDescription({
        category,
        name: row.name,
        raw,
      });
    const payload = snapshotItemPayload({
      name: row.name,
      type,
      slug: copyKey,
      properties: [`Codex: ${category}`],
      description,
      optionContent: {
        kind: "background",
        background: buildBackgroundDefinition({
          id: itemDefinitionId(`background-${row.slug}`),
          name: row.name,
          description,
          skillProficiencies: backgroundSkillProficiencies(raw),
          featureEntries: backgroundFeatureEntries(raw).map((entry) => ({
            name: entry.name,
            description: entry.description,
          })),
          originFeat: backgroundOriginFeatName(raw),
        }),
      },
    });
    return insertSnapshotItem({
      ownerId,
      copyKey,
      ...payload,
    });
  }

  if (category === "Feats") {
    const [row] = await db
      .select()
      .from(codexFeats)
      .where(eq(codexFeats.slug, slug))
      .limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Codex entry not found." });
    const raw = row.raw ?? {};
    const benefitText = featBenefits(raw).join("\n\n");
    const description =
      row.description?.trim() ||
      benefitText ||
      buildCodexSnapshotDescription({
        category,
        name: row.name,
        raw,
        extras: row.prerequisite ? [`Prerequisite: ${row.prerequisite}`] : [],
      });
    const payload = snapshotItemPayload({
      name: row.name,
      type,
      slug: copyKey,
      properties: [
        `Codex: ${category}`,
        row.featType ? `Type: ${row.featType}` : "",
      ].filter(Boolean),
      description,
      optionContent: {
        kind: "feat",
        feat: buildFeatDefinition({
          id: itemDefinitionId(`feat-${row.slug}`),
          name: row.name,
          description,
          prerequisite: row.prerequisite,
          featType: row.featType,
        }),
      },
    });
    return insertSnapshotItem({
      ownerId,
      copyKey,
      ...payload,
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
  if (input.category === "Gameplay Toolbox") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "Gameplay Toolbox homebrew is deferred — use Codex SRD 5.2 entries for traps, poisons, curses, environmental effects, and fear/stress.",
    });
  }
  return copySnapshot(input.ownerId, input.category, input.slug);
}

export function subclassSmithyCopyKey(slug: string): string {
  return `Subclasses:${slug}`;
}

export async function copySubclassToSmithy(input: {
  ownerId: string;
  slug: string;
}): Promise<CopyFromCodexResult> {
  const copyKey = subclassSmithyCopyKey(input.slug);
  const existing = await findOwnedSnapshotItem(input.ownerId, copyKey);
  if (existing) return { kind: "item", id: existing.id };

  const db = getDb();
  const [row] = await db
    .select()
    .from(codexSubclasses)
    .where(eq(codexSubclasses.slug, input.slug))
    .limit(1);
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Codex subclass not found." });
  }

  const type = codexCategorySnapshotType("Classes");
  const description = row.description.trim();
  const payload = snapshotItemPayload({
    name: row.name,
    type,
    slug: copyKey,
    properties: [
      "Codex: Subclass",
      row.className,
      `Pick at level ${row.pickLevel}`,
    ],
    description,
    optionContent: {
      kind: "subclass",
      subclass: buildSubclassDefinition({
        id: itemDefinitionId(row.slug),
        name: row.name,
        className: row.className,
        classSlug: row.classSlug,
        pickLevel: row.pickLevel,
        description,
        features: row.features,
      }),
    },
  });

  return insertSnapshotItem({
    ownerId: input.ownerId,
    copyKey,
    ...payload,
  });
}

export function parseSmithyCopyKey(copyKey: string): {
  category: CodexCategory | "Subclasses";
  slug: string;
} {
  const colon = copyKey.indexOf(":");
  if (colon === -1) {
    return { category: "Items", slug: copyKey };
  }
  const category = copyKey.slice(0, colon);
  if (category === "Subclasses") {
    return { category: "Subclasses", slug: copyKey.slice(colon + 1) };
  }
  return {
    category: category as CodexCategory,
    slug: copyKey.slice(colon + 1),
  };
}

function snapshotItemPayload(input: {
  name: string;
  type: ItemType;
  description: string;
  properties: string[];
  requiresAttunement?: boolean;
  slug: string;
  optionContent?: ItemOptionContent;
}) {
  return {
    name: input.name,
    type: input.type,
    description: input.description,
    properties: input.properties,
    requiresAttunement: input.requiresAttunement ?? false,
    definition: buildItemDefinition({
      id: itemDefinitionId(input.slug),
      name: input.name,
      itemType: input.type,
      description: input.description,
      ...(input.optionContent ? { optionContent: input.optionContent } : {}),
    }),
  };
}

async function codexItemCopyPayload(
  category: CodexCategory | "Subclasses",
  slug: string,
): Promise<{
  name: string;
  type: ItemType;
  description: string;
  properties: string[];
  requiresAttunement: boolean;
  definition: ItemDefinition;
}> {
  if (category === "Items") {
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
    const description =
      codex.description?.trim() ||
      buildCodexSnapshotDescription({
        category: "Items",
        name: codex.name,
        raw,
      });
    const type = open5eItemCategoryToType(codex.category);
    const definition = open5eRawToItemDefinition(raw, {
      slug: codex.slug,
      name: codex.name,
      category: codex.category,
      description,
      itemType: type,
      cost: codex.cost,
      weight: codex.weight,
      weightUnit: codex.weightUnit,
    });
    return {
      name: codex.name,
      type,
      description,
      properties: weaponPropertyEntries(raw).map((p) => p.name),
      requiresAttunement: Boolean(raw.requires_attunement),
      definition,
    };
  }

  if (category === "Subclasses") {
    const db = getDb();
    const [row] = await db
      .select()
      .from(codexSubclasses)
      .where(eq(codexSubclasses.slug, slug))
      .limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Codex subclass not found." });
    const description = row.description.trim();
    const payload = snapshotItemPayload({
      name: row.name,
      type: codexCategorySnapshotType("Classes"),
      slug: subclassSmithyCopyKey(slug),
      properties: [
        "Codex: Subclass",
        row.className,
        `Pick at level ${row.pickLevel}`,
      ],
      description,
      optionContent: {
        kind: "subclass",
        subclass: buildSubclassDefinition({
          id: itemDefinitionId(row.slug),
          name: row.name,
          className: row.className,
          classSlug: row.classSlug,
          pickLevel: row.pickLevel,
          description,
          features: row.features,
        }),
      },
    });
    return {
      ...payload,
      requiresAttunement: false,
    };
  }

  const copyKey = codexSmithyCopyKey(category, slug);
  const type = codexCategorySnapshotType(category);
  const db = getDb();

  if (category === "Species") {
    const [row] = await db
      .select()
      .from(codexSpecies)
      .where(eq(codexSpecies.slug, slug))
      .limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Codex entry not found." });
    return snapshotItemPayload({
      name: row.name,
      type,
      slug: copyKey,
      properties: [`Codex: ${category}`, ...row.traits.slice(0, 8)],
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
    return snapshotItemPayload({
      name: row.name,
      type,
      slug: copyKey,
      properties: [`Codex: ${category}`, `Hit die d${row.hitDie}`],
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
    const raw = row.raw ?? {};
    const description =
      row.description?.trim() ||
      buildCodexSnapshotDescription({
        category,
        name: row.name,
        raw,
      });
    return snapshotItemPayload({
      name: row.name,
      type,
      slug: copyKey,
      properties: [`Codex: ${category}`],
      description,
      optionContent: {
        kind: "background",
        background: buildBackgroundDefinition({
          id: itemDefinitionId(`background-${row.slug}`),
          name: row.name,
          description,
          skillProficiencies: backgroundSkillProficiencies(raw),
          featureEntries: backgroundFeatureEntries(raw).map((entry) => ({
            name: entry.name,
            description: entry.description,
          })),
          originFeat: backgroundOriginFeatName(raw),
        }),
      },
    });
  }

  if (category === "Feats") {
    const [row] = await db
      .select()
      .from(codexFeats)
      .where(eq(codexFeats.slug, slug))
      .limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Codex entry not found." });
    const raw = row.raw ?? {};
    const benefitText = featBenefits(raw).join("\n\n");
    const description =
      row.description?.trim() ||
      benefitText ||
      buildCodexSnapshotDescription({
        category,
        name: row.name,
        raw,
        extras: row.prerequisite ? [`Prerequisite: ${row.prerequisite}`] : [],
      });
    return snapshotItemPayload({
      name: row.name,
      type,
      slug: copyKey,
      properties: [
        `Codex: ${category}`,
        row.featType ? `Type: ${row.featType}` : "",
      ].filter(Boolean),
      description,
      optionContent: {
        kind: "feat",
        feat: buildFeatDefinition({
          id: itemDefinitionId(`feat-${row.slug}`),
          name: row.name,
          description,
          prerequisite: row.prerequisite,
          featType: row.featType,
        }),
      },
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
    return snapshotItemPayload({
      name: row.name,
      type,
      slug: copyKey,
      properties: [
        `Codex: ${category}`,
        row.creatureType ?? "",
        row.challengeRating != null
          ? `CR ${formatChallengeRating(row.challengeRating)}`
          : "",
      ].filter(Boolean),
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
    return snapshotItemPayload({
      name: row.name,
      type,
      slug: copyKey,
      properties: [`Codex: ${category}`],
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
    message: `Reset is not supported for ${category}.`,
  });
}

/** Re-apply the current Codex SRD source onto an owned homebrew spell (SMITH-6). */
export async function resetHomebrewSpellFromCodex(input: {
  ownerId: string;
  spellId: string;
}) {
  const db = getDb();
  const [spell] = await db
    .select()
    .from(homebrewSpells)
    .where(
      and(
        eq(homebrewSpells.id, input.spellId),
        eq(homebrewSpells.ownerId, input.ownerId),
      ),
    )
    .limit(1);
  if (!spell?.copiedFromSlug || spell.source !== "codex") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only Codex-copied spells can be reset to SRD.",
    });
  }

  const [codex] = await db
    .select()
    .from(codexSpells)
    .where(eq(codexSpells.slug, spell.copiedFromSlug))
    .limit(1);
  if (!codex) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Original Codex spell not found." });
  }

  const definition = open5eRawToSpellDefinition(codex.raw, {
    slug: codex.slug,
    name: codex.name,
  });
  const errors = validateSpellDefinition(definition);
  if (errors.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Could not rebuild spell from Codex: ${errors.join(" ")}`,
    });
  }

  const [row] = await db
    .update(homebrewSpells)
    .set({
      name: definition.name,
      level: definition.level,
      school: definition.school,
      description: definition.description,
      definition,
      updatedAt: new Date(),
    })
    .where(eq(homebrewSpells.id, input.spellId))
    .returning();
  return row!;
}

/** Re-apply the current Codex SRD source onto an owned homebrew item (SMITH-6). */
export async function resetHomebrewItemFromCodex(input: {
  ownerId: string;
  itemId: string;
}) {
  const db = getDb();
  const [item] = await db
    .select()
    .from(homebrewItems)
    .where(
      and(
        eq(homebrewItems.id, input.itemId),
        eq(homebrewItems.ownerId, input.ownerId),
      ),
    )
    .limit(1);
  if (!item?.copiedFromSlug || item.source !== "codex") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only Codex-copied entries can be reset to SRD.",
    });
  }

  const { category, slug } = parseSmithyCopyKey(item.copiedFromSlug);
  const payload = await codexItemCopyPayload(category, slug);

  const [row] = await db
    .update(homebrewItems)
    .set({
      ...payload,
      updatedAt: new Date(),
    })
    .where(eq(homebrewItems.id, input.itemId))
    .returning();
  return row!;
}
