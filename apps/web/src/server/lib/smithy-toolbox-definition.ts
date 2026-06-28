import { TRPCError } from "@trpc/server";

import {
  toolboxEntryId,
  validateGameplayToolboxEntryDefinition,
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

export function assembleToolboxDefinition(input: {
  topic: ToolboxTopic;
  trap?: SmithyTrapFormInput;
  poison?: SmithyPoisonFormInput;
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
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `Forge for ${input.topic} is not supported yet.`,
  });
}
