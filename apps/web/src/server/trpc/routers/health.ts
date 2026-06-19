import { count } from "drizzle-orm";

import { getDb, codexSpells } from "@app/db";
import { getEngineHealth } from "@app/engine";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "../init";

export const healthRouter = createTRPCRouter({
  ping: publicProcedure.query(() => ({ ok: true as const, ts: Date.now() })),
  engine: publicProcedure.query(() => getEngineHealth()),
  me: protectedProcedure.query(({ ctx }) => ({
    id: ctx.user.id,
    email: ctx.user.email,
  })),
  codexSpellCount: protectedProcedure.query(async () => {
    try {
      const db = getDb();
      const [row] = await db.select({ value: count() }).from(codexSpells);
      return { count: row?.value ?? 0 };
    } catch {
      return { count: null as number | null };
    }
  }),
});
