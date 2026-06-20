import { createTRPCRouter } from "./init";
import { campaignsRouter } from "./routers/campaigns";
import { charactersRouter } from "./routers/characters";
import { codexRouter } from "./routers/codex";
import { engineRouter } from "./routers/engine";
import { healthRouter } from "./routers/health";
import { smithyRouter } from "./routers/smithy";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  codex: codexRouter,
  characters: charactersRouter,
  campaigns: campaignsRouter,
  engine: engineRouter,
  smithy: smithyRouter,
});

export type AppRouter = typeof appRouter;
