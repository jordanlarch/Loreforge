import { createTRPCRouter } from "./init";
import { codexRouter } from "./routers/codex";
import { engineRouter } from "./routers/engine";
import { healthRouter } from "./routers/health";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  codex: codexRouter,
  engine: engineRouter,
});

export type AppRouter = typeof appRouter;
