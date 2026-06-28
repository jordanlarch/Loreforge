import { TRPCError } from "@trpc/server";

import {
  toolboxEntryId,
  validateGameplayToolboxEntryDefinition,
  type CurseDefinition,
  type EnvironmentalEffectDefinition,
  type GameplayToolboxEntryDefinition,
  type PoisonDefinition,
  type PoisonType,
  type ToolboxCheck,
  type ToolboxDamage,
  type ToolboxSave,
  type TrapDefinition,
  type TrapEffect,
  type ToolboxTopic,
} from "@app/engine";

export type SmithyTrapFormInput = {
  name: string;
  description: string;
  trigger: string;
  effect: TrapEffect;
  detect?: ToolboxCheck;
  disable?: ToolboxCheck;
  reset: TrapDefinition["reset"];
  resetInterval?: string;
};

export type SmithyPoisonFormInput = {
  name: string;
  description: string;
  poisonType: PoisonType;
  save?: ToolboxSave;
  damage?: ToolboxDamage[];
  conditions?: string[];
  repeat?: string;
};

export type SmithyCurseFormInput = {
  name: string;
  description: string;
  contagion?: string;
  save?: ToolboxSave;
  effects?: string[];
  recovery?: string;
};

export type SmithyEnvironmentalEffectFormInput = {
  name: string;
  description: string;
  area?: string;
  duration?: string;
  save?: ToolboxSave;
  damage?: ToolboxDamage[];
  conditions?: string[];
  repeat?: string;
};

export function assembleTrapDefinition(
  input: SmithyTrapFormInput,
): TrapDefinition {
  const definition: TrapDefinition = {
    kind: "trap",
    id: toolboxEntryId(input.name),
    name: input.name.trim(),
    description: input.description.trim(),
    trigger: input.trigger.trim(),
    effect: input.effect,
    detect: input.detect,
    disable: input.disable,
    reset: input.reset,
    resetInterval: input.resetInterval?.trim() || undefined,
  };

  const errors = validateGameplayToolboxEntryDefinition(definition);
  if (errors.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: errors.join(" "),
    });
  }

  return definition;
}

export function assemblePoisonDefinition(
  input: SmithyPoisonFormInput,
): PoisonDefinition {
  const definition: PoisonDefinition = {
    kind: "poison",
    id: toolboxEntryId(input.name),
    name: input.name.trim(),
    description: input.description.trim(),
    poisonType: input.poisonType,
    save: input.save,
    damage: input.damage,
    conditions: input.conditions,
    repeat: input.repeat?.trim() || undefined,
  };

  const errors = validateGameplayToolboxEntryDefinition(definition);
  if (errors.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: errors.join(" "),
    });
  }

  return definition;
}

export function assembleCurseDefinition(
  input: SmithyCurseFormInput,
): CurseDefinition {
  const definition: CurseDefinition = {
    kind: "curse",
    id: toolboxEntryId(input.name),
    name: input.name.trim(),
    description: input.description.trim(),
    contagion: input.contagion?.trim() || undefined,
    save: input.save,
    effects: input.effects?.length ? input.effects : undefined,
    recovery: input.recovery?.trim() || undefined,
  };

  const errors = validateGameplayToolboxEntryDefinition(definition);
  if (errors.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: errors.join(" "),
    });
  }

  return definition;
}

export function assembleEnvironmentalEffectDefinition(
  input: SmithyEnvironmentalEffectFormInput,
): EnvironmentalEffectDefinition {
  const definition: EnvironmentalEffectDefinition = {
    kind: "environmental_effect",
    id: toolboxEntryId(input.name),
    name: input.name.trim(),
    description: input.description.trim(),
    area: input.area?.trim() || undefined,
    duration: input.duration?.trim() || undefined,
    save: input.save,
    damage: input.damage,
    conditions: input.conditions,
    repeat: input.repeat?.trim() || undefined,
  };

  const errors = validateGameplayToolboxEntryDefinition(definition);
  if (errors.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: errors.join(" "),
    });
  }

  return definition;
}

export function assembleToolboxDefinition(input: {
  topic: ToolboxTopic;
  trap?: SmithyTrapFormInput;
  poison?: SmithyPoisonFormInput;
  curse?: SmithyCurseFormInput;
  environmentalEffect?: SmithyEnvironmentalEffectFormInput;
}): GameplayToolboxEntryDefinition {
  if (input.topic === "trap") {
    if (!input.trap) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Trap mechanics are required.",
      });
    }
    return assembleTrapDefinition(input.trap);
  }
  if (input.topic === "poison") {
    if (!input.poison) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Poison mechanics are required.",
      });
    }
    return assemblePoisonDefinition(input.poison);
  }
  if (input.topic === "curse") {
    if (!input.curse) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Curse mechanics are required.",
      });
    }
    return assembleCurseDefinition(input.curse);
  }
  if (input.topic === "environmental_effect") {
    if (!input.environmentalEffect) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Environmental effect mechanics are required.",
      });
    }
    return assembleEnvironmentalEffectDefinition(input.environmentalEffect);
  }
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `Forge for ${input.topic} is not supported yet.`,
  });
}
