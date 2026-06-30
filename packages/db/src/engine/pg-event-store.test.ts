import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Engine, buildFixtureCampaign, rebuild } from "@app/engine";

import { PgEventStore } from "./pg-event-store";
import * as schema from "../schema/index";

// A real (uuid) campaign id so the rows satisfy the uuid column type; it also
// doubles as the engine's deterministic RNG seed.
const CAMPAIGN = "00000000-0000-4000-8000-000000000001";

const CREATE_ENGINE_EVENTS = `
  CREATE TABLE engine_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL,
    session_id uuid,
    sequence bigint NOT NULL,
    type text NOT NULL,
    payload jsonb NOT NULL,
    meta jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT engine_events_campaign_seq_unique UNIQUE (campaign_id, sequence)
  );
`;

let client: PGlite;
let store: PgEventStore;

beforeAll(async () => {
  client = new PGlite();
  await client.exec(CREATE_ENGINE_EVENTS);
  const db = drizzle(client, { schema });
  store = new PgEventStore(db);
});

afterAll(async () => {
  await client.close();
});

describe("PgEventStore", () => {
  it("rebuild-from-DB equals the in-memory rebuild for a fixture campaign", async () => {
    // Drive the fixture campaign through an engine backed by Postgres (PGlite).
    const dbEngine = new Engine({ store, now: () => 42 });
    const { state: dbState } = await buildFixtureCampaign(CAMPAIGN, dbEngine);

    // The same command stream through a pure in-memory engine.
    const memEngine = new Engine({ now: () => 42 });
    const { state: memState } = await buildFixtureCampaign(CAMPAIGN, memEngine);

    // Live DB-backed projection matches in-memory.
    expect(dbState).toEqual(memState);

    // Rebuilding the projection from the persisted log matches in-memory.
    const eventsFromDb = await store.read(CAMPAIGN);
    expect(rebuild(CAMPAIGN, eventsFromDb)).toEqual(memState);

    // A fresh engine hydrates its state from Postgres alone.
    const hydrated = new Engine({ store, now: () => 42 });
    expect(await hydrated.getState(CAMPAIGN)).toEqual(memState);
  });

  it("assigns contiguous per-campaign sequence numbers and reads them back", async () => {
    const events = await store.read(CAMPAIGN);
    // Fixture campaign emits: create_scene, change_scene, 3× create_entity.
    expect(events.map((e) => e.sequence)).toEqual([1, 2, 3, 4, 5]);
    expect(await store.lastSequence(CAMPAIGN)).toBe(5);
    expect(events[0]?.type).toBe("SceneCreated");
    // Envelope metadata round-trips through the meta column.
    expect(events[0]?.causedByCommandId).toBeTruthy();
    expect(events[0]?.timestamp).toBe(42);
  });

  it("readAfter returns only later events; truncate removes them", async () => {
    const tail = await store.readAfter(CAMPAIGN, 2);
    expect(tail.map((e) => e.sequence)).toEqual([3, 4, 5]);

    const removed = await store.truncate(CAMPAIGN, 2);
    expect(removed.map((e) => e.sequence)).toEqual([3, 4, 5]);
    expect(await store.lastSequence(CAMPAIGN)).toBe(2);
  });
});
