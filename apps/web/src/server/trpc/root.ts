import { createTRPCRouter } from "./init";
import { campaignsRouter } from "./routers/campaigns";
import { charactersRouter } from "./routers/characters";
import { codexRouter } from "./routers/codex";
import { engineRouter } from "./routers/engine";
import { healthRouter } from "./routers/health";
import { hooksRouter } from "./routers/hooks";
import { memoryRouter } from "./routers/memory";
import { notesRouter } from "./routers/notes";
import { realmsRouter } from "./routers/realms";
import { sessionsRouter } from "./routers/sessions";
import { smithyRouter } from "./routers/smithy";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  codex: codexRouter,
  characters: charactersRouter,
  campaigns: campaignsRouter,
  engine: engineRouter,
  hooks: hooksRouter,
  memory: memoryRouter,
  notes: notesRouter,
  realms: realmsRouter,
  sessions: sessionsRouter,
  smithy: smithyRouter,
});

export type AppRouter = typeof appRouter;
