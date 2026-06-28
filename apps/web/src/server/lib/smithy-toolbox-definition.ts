import { TRPCError } from "@trpc/server";

import {
  toolboxEntryId,
  validateGameplayToolboxEntryDefinition,
  type GameplayToolboxEntryDefinition,
  type TrapDefinition,
  type ToolboxCheck,
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

export function assembleTrapDefinition(
  input: SmithyTrapFormInput,
  topic: ToolboxTopic = "trap",
): GameplayToolboxEntryDefinition {
  if (topic !== "trap") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Only trap entries can be forged in v1.",
    });
  }

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
