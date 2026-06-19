import { createTRPCRouter } from "./init";
import { campaignsRouter } from "./routers/campaigns";
import { charactersRouter } from "./routers/characters";
import { codexRouter } from "./routers/codex";
import { engineRouter } from "./routers/engine";
import { healthRouter } from "./routers/health";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  codex: codexRouter,
  characters: charactersRouter,
  campaigns: campaignsRouter,
  engine: engineRouter,
});

export type AppRouter = typeof appRouter;
