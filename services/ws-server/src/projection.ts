/**
 * WorldState ⇄ Y.Doc projection mapping (#14, scope A).
 *
 * The engine is server-authoritative; Yjs is only the transport for the
 * projection it produces (`docs/engine/architecture.md` §10.1). This module is
 * the single writer's view of that contract: it folds an authoritative
 * {@link WorldState} into a shallow-structured Y.Doc and reads it back out.
 *
 * Doc shape (root Y.Map `"battle"`):
 *   - `meta`      → { campaignId, currentSceneId, lastSequence }
 *   - `scene`     → the current SceneState (or null)
 *   - `encounter` → the active EncounterState (or null)
 *   - `entities`  → nested Y.Map keyed by entity id → EntityState
 *
 * Only the keys that actually change are written, so a single token move
 * broadcasts one entity's worth of data rather than the whole battle. Because
 * the server is the *sole* writer, Yjs conflict-merge never applies to doc
 * content — granularity here is purely a bandwidth/diff concern.
 *
 * The client reassembles the same field names back into a WorldState subset
 * (see `apps/web/.../play/use-live-session.ts`); keep the two in sync.
 */
import * as Y from "yjs";
import type {
  EncounterState,
  EntityState,
  SceneState,
  WorldState,
} from "@app/engine";

export const BATTLE_ROOT = "battle";
export const META = "meta";
export const SCENE = "scene";
export const ENCOUNTER = "encounter";
export const ENTITIES = "entities";

export type BattleMeta = {
  campaignId: string;
  currentSceneId: string | null;
  lastSequence: number;
};

/** Which keys a {@link writeProjection} call actually mutated (for tests/metrics). */
export type ProjectionDiff = {
  meta: boolean;
  scene: boolean;
  encounter: boolean;
  entities: string[];
};

function jsonEq(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function metaOf(state: WorldState): BattleMeta {
  return {
    campaignId: state.campaignId,
    currentSceneId: state.currentSceneId ?? null,
    lastSequence: state.lastSequence,
  };
}

function currentScene(state: WorldState): SceneState | null {
  const id = state.currentSceneId;
  return (id ? state.scenes[id] : undefined) ?? null;
}

function entitiesMap(root: Y.Map<unknown>): Y.Map<EntityState> {
  let entities = root.get(ENTITIES) as Y.Map<EntityState> | undefined;
  if (!(entities instanceof Y.Map)) {
    entities = new Y.Map<EntityState>();
    root.set(ENTITIES, entities);
  }
  return entities;
}

/**
 * Fold the authoritative world state into the Y.Doc, writing only changed keys.
 * Idempotent: re-writing the same state mutates nothing. Returns the diff.
 */
export function writeProjection(doc: Y.Doc, state: WorldState): ProjectionDiff {
  const root = doc.getMap(BATTLE_ROOT) as Y.Map<unknown>;
  const diff: ProjectionDiff = {
    meta: false,
    scene: false,
    encounter: false,
    entities: [],
  };

  const meta = metaOf(state);
  const scene = currentScene(state);
  const encounter = state.encounter ?? null;

  doc.transact(() => {
    if (!jsonEq(root.get(META), meta)) {
      root.set(META, meta);
      diff.meta = true;
    }
    if (!jsonEq(root.get(SCENE), scene)) {
      root.set(SCENE, scene);
      diff.scene = true;
    }
    if (!jsonEq(root.get(ENCOUNTER), encounter)) {
      root.set(ENCOUNTER, encounter);
      diff.encounter = true;
    }

    const entities = entitiesMap(root);
    for (const [id, entity] of Object.entries(state.entities)) {
      if (!jsonEq(entities.get(id), entity)) {
        entities.set(id, entity);
        diff.entities.push(id);
      }
    }
    for (const id of [...entities.keys()]) {
      if (!(id in state.entities)) {
        entities.delete(id);
        diff.entities.push(id);
      }
    }
  });

  return diff;
}

/**
 * Reassemble a WorldState subset from the Y.Doc. Returns null before the doc
 * has been seeded. Carries exactly the fields the battle-map view model reads.
 */
export function readProjection(doc: Y.Doc): WorldState | null {
  const root = doc.getMap(BATTLE_ROOT) as Y.Map<unknown>;
  const meta = root.get(META) as BattleMeta | undefined;
  if (!meta) return null;

  const scene = (root.get(SCENE) as SceneState | null) ?? null;
  const encounter = (root.get(ENCOUNTER) as EncounterState | null) ?? null;
  const entities: Record<string, EntityState> = {};
  const map = root.get(ENTITIES) as Y.Map<EntityState> | undefined;
  if (map instanceof Y.Map) {
    for (const [id, entity] of map.entries()) {
      entities[id] = entity;
    }
  }

  return {
    campaignId: meta.campaignId,
    currentSceneId: meta.currentSceneId ?? undefined,
    lastSequence: meta.lastSequence,
    scenes: scene ? { [scene.id]: scene } : {},
    entities,
    encounter: encounter ?? undefined,
  };
}
