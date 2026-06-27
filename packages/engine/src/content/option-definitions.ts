/**
 * Typed Smithy/Codex definitions for non-item character options (SMITHY-TYPED-COPY).
 * Stored on {@link ItemDefinition.optionContent} for Codex snapshot rows.
 */

export type SubclassFeatureDefinition = {
  level: number;
  name: string;
  description: string;
};

export type OptionSubclassDefinition = {
  id: string;
  name: string;
  className: string;
  classSlug: string;
  pickLevel: number;
  description: string;
  features: SubclassFeatureDefinition[];
};

export type OptionBackgroundDefinition = {
  id: string;
  name: string;
  description: string;
  skillProficiencies?: string[];
  featureEntries?: { name: string; description: string }[];
  originFeat?: string | null;
};

export type OptionFeatDefinition = {
  id: string;
  name: string;
  description: string;
  prerequisite?: string | null;
  featType?: string | null;
};

export type ItemOptionContent =
  | { kind: "subclass"; subclass: OptionSubclassDefinition }
  | { kind: "background"; background: OptionBackgroundDefinition }
  | { kind: "feat"; feat: OptionFeatDefinition };

export function optionDefinitionId(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "option"
  );
}

export function buildSubclassDefinition(input: {
  name: string;
  className: string;
  classSlug: string;
  pickLevel: number;
  description: string;
  features: SubclassFeatureDefinition[];
  id?: string;
}): OptionSubclassDefinition {
  return {
    id: input.id ?? optionDefinitionId(input.name),
    name: input.name.trim(),
    className: input.className.trim(),
    classSlug: input.classSlug.trim(),
    pickLevel: input.pickLevel,
    description: input.description.trim(),
    features: input.features,
  };
}

export function buildBackgroundDefinition(input: {
  name: string;
  description: string;
  skillProficiencies?: string[];
  featureEntries?: { name: string; description: string }[];
  originFeat?: string | null;
  id?: string;
}): OptionBackgroundDefinition {
  return {
    id: input.id ?? optionDefinitionId(input.name),
    name: input.name.trim(),
    description: input.description.trim(),
    ...(input.skillProficiencies?.length
      ? { skillProficiencies: input.skillProficiencies }
      : {}),
    ...(input.featureEntries?.length
      ? { featureEntries: input.featureEntries }
      : {}),
    ...(input.originFeat ? { originFeat: input.originFeat } : {}),
  };
}

export function buildFeatDefinition(input: {
  name: string;
  description: string;
  prerequisite?: string | null;
  featType?: string | null;
  id?: string;
}): OptionFeatDefinition {
  return {
    id: input.id ?? optionDefinitionId(input.name),
    name: input.name.trim(),
    description: input.description.trim(),
    prerequisite: input.prerequisite ?? null,
    featType: input.featType ?? null,
  };
}
