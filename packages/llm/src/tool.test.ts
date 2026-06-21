import { describe, expect, it } from "vitest";
import { z } from "zod";

import { EMIT_ENTITY_TOOL_NAME, buildEmitEntityTool } from "./tool";

describe("buildEmitEntityTool", () => {
  it("derives a top-level object schema from a zod object", () => {
    const tool = buildEmitEntityTool(
      z.object({ name: z.string(), level: z.number().int() }),
    );

    expect(tool.name).toBe(EMIT_ENTITY_TOOL_NAME);
    expect(tool.inputSchema.type).toBe("object");
    expect(Object.keys(tool.inputSchema.properties ?? {})).toEqual([
      "name",
      "level",
    ]);
  });

  it("honors a custom tool name and description", () => {
    const tool = buildEmitEntityTool(z.object({ x: z.string() }), {
      name: "emit_region",
      description: "Emit a region.",
    });
    expect(tool.name).toBe("emit_region");
    expect(tool.description).toBe("Emit a region.");
  });
});
