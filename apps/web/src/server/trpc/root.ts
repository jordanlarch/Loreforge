import { createTRPCRouter } from "./init";
import { charactersRouter } from "./routers/characters";
import { codexRouter } from "./routers/codex";
import { engineRouter } from "./routers/engine";
import { healthRouter } from "./routers/health";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  codex: codexRouter,
  characters: charactersRouter,
  engine: engineRouter,
});

export type AppRouter = typeof appRouter;
