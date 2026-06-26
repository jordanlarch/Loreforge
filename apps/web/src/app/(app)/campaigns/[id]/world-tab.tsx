"use client";

import Link from "next/link";
import { useState } from "react";

import {
  REALM_TYPE_COLOR,
  REALM_TYPE_LABEL,
  layoutGraph,
  type RealmEntityType,
} from "@/lib/realms";
import { isExplorableRealmType, sceneIdForRealmEntity } from "@app/engine";
import { stubSupportsEncounters } from "@/lib/overworld-map";
import { trpc } from "@/lib/trpc/client";

import { StubEncounterPanel } from "./stub-encounter-panel";
import { RealmsEditLightbox } from "./realms-edit-lightbox";

type WorldView = "list" | "graph";

/**
 * World tab (#60): the campaign-scoped slice of Realms, with per-campaign
 * discovery state (Q11). Prep mode supports authoring; play mode is browse-only
 * for invited players (CAMP-UX UX-6).
 */
export function WorldTab({
  campaignId,
  variant = "prep",
  onEnterLocation,
}: {
  campaignId: string;
  variant?: "prep" | "play";
  /** When set (play shell), travel in-place instead of linking to /play. */
  onEnterLocation?: (entityId: string) => void;
}) {
  const utils = trpc.useUtils();
  const access = trpc.campaigns.access.useQuery({ campaignId });
  const world = trpc.campaigns.world.useQuery({ campaignId });
  const allEntities = trpc.realms.list.useQuery(undefined, {
    enabled: variant === "prep" && access.data?.role === "owner",
  });

  const [view, setView] = useState<WorldView>("list");
  const [addId, setAddId] = useState("");
  const [editEntity, setEditEntity] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const isOwner = access.data?.role === "owner";
  const prepAuthoring = variant === "prep" && isOwner;
  const playBrowse = variant === "play";

  async function refresh() {
    await Promise.all([
      utils.campaigns.world.invalidate({ campaignId }),
      utils.campaigns.worldGraph.invalidate({ campaignId }),
    ]);
  }

  const add = trpc.campaigns.addWorldEntity.useMutation({
    onSuccess: async () => {
      setAddId("");
      await refresh();
    },
  });
  const remove = trpc.campaigns.removeWorldEntity.useMutation({
    onSuccess: refresh,
  });
  const setDiscovered = trpc.campaigns.setWorldEntityDiscovered.useMutation({
    onSuccess: refresh,
  });
  const setStarting = trpc.campaigns.setStartingScene.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.campaigns.get.invalidate({ id: campaignId }),
        utils.campaigns.playReadiness.invalidate({ campaignId }),
      ]);
    },
  });

  const campaign = trpc.campaigns.get.useQuery(
    { id: campaignId },
    { enabled: prepAuthoring },
  );

  const members = world.data ?? [];
  const visibleMembers =
    playBrowse && access.data?.role === "player"
      ? members.filter((m) => m.discovered)
      : members;
  const memberIds = new Set(members.map((m) => m.id));
  const available = (allEntities.data ?? []).filter(
    (e) => !memberIds.has(e.id),
  );

  return (
    <div className="flex flex-col gap-6">
      <RealmsEditLightbox
        entityId={editEntity?.id ?? ""}
        entityName={editEntity?.name ?? ""}
        open={editEntity !== null}
        onClose={() => setEditEntity(null)}
      />

      {/* —— Header / actions —— */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">
          {variant === "play" ? "World" : "Locations"}
        </h2>
        {prepAuthoring ? (
          <div className="flex flex-wrap items-center gap-2">
            {available.length > 0 ? (
              <>
                <select
                  value={addId}
                  onChange={(e) => setAddId(e.target.value)}
                  className="rounded border border-lore-border bg-lore-bg px-3 py-1.5 text-sm outline-none focus:border-lore-accent"
                >
                  <option value="">Add from Realms…</option>
                  {available.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({REALM_TYPE_LABEL[e.type as RealmEntityType]})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() =>
                    addId && add.mutate({ campaignId, entityId: addId })
                  }
                  disabled={!addId || add.isPending}
                  className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
                >
                  {add.isPending ? "Adding…" : "Add"}
                </button>
              </>
            ) : (
              <Link
                href="/realms"
                className="rounded border border-lore-border px-3 py-1.5 text-sm transition-colors hover:border-lore-accent"
              >
                Open Realms
              </Link>
            )}
            <div className="flex overflow-hidden rounded border border-lore-border text-sm">
              <button
                type="button"
                onClick={() => setView("list")}
                className={`px-3 py-1.5 ${view === "list" ? "bg-lore-accent-dim text-lore-text" : "text-lore-muted hover:text-lore-text"}`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setView("graph")}
                className={`px-3 py-1.5 ${view === "graph" ? "bg-lore-accent-dim text-lore-text" : "text-lore-muted hover:text-lore-text"}`}
              >
                Graph
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {add.error && <p className="text-sm text-red-400">{add.error.message}</p>}

      {world.isLoading ? (
        <p className="text-sm text-lore-muted">Loading world…</p>
      ) : visibleMembers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-lore-border p-12 text-center text-lore-muted">
          {playBrowse
            ? "No discovered locations yet."
            : "No world entities in this campaign yet. Add some from Realms to build the party's known world."}
        </div>
      ) : view === "list" || playBrowse ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleMembers.map((entity) => (
            <li
              key={entity.membershipId}
              className="flex h-full flex-col gap-2 rounded-lg border border-lore-border bg-lore-surface p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-display text-lg">{entity.name}</span>
                <span
                  className="rounded px-2 py-0.5 text-xs"
                  style={{
                    color: REALM_TYPE_COLOR[entity.type as RealmEntityType],
                  }}
                >
                  {REALM_TYPE_LABEL[entity.type as RealmEntityType]}
                </span>
              </div>
              {entity.summary && (
                <p className="line-clamp-2 text-sm text-lore-muted">
                  {entity.summary}
                </p>
              )}
              {prepAuthoring ? (
                <button
                  type="button"
                  onClick={() =>
                    setEditEntity({ id: entity.id, name: entity.name })
                  }
                  className="self-start rounded border border-lore-border px-2 py-1 text-xs text-lore-muted transition-colors hover:border-lore-accent hover:text-lore-text"
                >
                  Edit stub
                </button>
              ) : null}
              {prepAuthoring &&
              stubSupportsEncounters(entity.type as RealmEntityType) ? (
                <StubEncounterPanel
                  campaignId={campaignId}
                  entityId={entity.id}
                  entityName={entity.name}
                />
              ) : null}
              {prepAuthoring && isExplorableRealmType(entity.type) ? (
                <button
                  type="button"
                  onClick={() =>
                    setStarting.mutate({
                      campaignId,
                      entityId: entity.id,
                    })
                  }
                  disabled={
                    setStarting.isPending ||
                    campaign.data?.startingSceneId ===
                      sceneIdForRealmEntity(entity.id)
                  }
                  className={`self-start rounded border px-2 py-1 text-xs transition-colors disabled:opacity-40 ${
                    campaign.data?.startingSceneId ===
                    sceneIdForRealmEntity(entity.id)
                      ? "border-lore-accent text-lore-accent"
                      : "border-lore-border text-lore-muted hover:text-lore-text"
                  }`}
                >
                  {campaign.data?.startingSceneId ===
                  sceneIdForRealmEntity(entity.id)
                    ? "★ Campaign start"
                    : "Set as campaign start"}
                </button>
              ) : null}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 text-sm">
                {isExplorableRealmType(entity.type) ? (
                  onEnterLocation ? (
                    <button
                      type="button"
                      onClick={() => onEnterLocation(entity.id)}
                      className="rounded border border-lore-accent bg-lore-accent-dim px-2 py-1 text-xs text-lore-text transition-colors hover:border-lore-accent"
                    >
                      Enter location
                    </button>
                  ) : (
                    <Link
                      href={`/campaigns/${campaignId}/play?enter=${entity.id}`}
                      className="rounded border border-lore-accent bg-lore-accent-dim px-2 py-1 text-xs text-lore-text transition-colors hover:border-lore-accent"
                    >
                      Enter in Live Play
                    </Link>
                  )
                ) : (
                  <span className="text-xs text-lore-muted">Not explorable</span>
                )}
                {prepAuthoring ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setDiscovered.mutate({
                          campaignId,
                          entityId: entity.id,
                          discovered: !entity.discovered,
                        })
                      }
                      disabled={setDiscovered.isPending}
                      className={`rounded border px-2 py-1 text-xs transition-colors disabled:opacity-40 ${
                        entity.discovered
                          ? "border-lore-accent text-lore-accent"
                          : "border-lore-border text-lore-muted hover:text-lore-text"
                      }`}
                    >
                      {entity.discovered ? "✓ Discovered" : "Undiscovered"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        remove.mutate({ campaignId, entityId: entity.id })
                      }
                      disabled={remove.isPending}
                      className="text-lore-muted transition-colors hover:text-red-400 disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </>
                ) : entity.discovered ? (
                  <span className="text-xs text-lore-accent">Discovered</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <WorldGraph campaignId={campaignId} />
      )}
    </div>
  );
}

const SIZE = 1000;
const NODE_RADIUS = 14;

function WorldGraph({ campaignId }: { campaignId: string }) {
  const graph = trpc.campaigns.worldGraph.useQuery({ campaignId });
  const nodes = graph.data?.nodes ?? [];
  const edges = graph.data?.edges ?? [];
  const positions = layoutGraph(
    nodes.map((n) => ({ id: n.id })),
    edges.map((e) => ({ source: e.fromId, target: e.toId })),
    { width: SIZE, height: SIZE },
  );
  const nameById = new Map(nodes.map((n) => [n.id, n.name]));

  if (graph.isLoading) {
    return <p className="text-sm text-lore-muted">Loading graph…</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-lore-border bg-lore-bg">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-[560px] w-full"
        role="img"
        aria-label="Campaign world relationship graph"
      >
        {edges.map((edge) => {
          const a = positions[edge.fromId];
          const b = positions[edge.toId];
          if (!a || !b) return null;
          return (
            <line
              key={edge.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="#3f3f46"
              strokeWidth={2}
            >
              <title>{`${nameById.get(edge.fromId) ?? "?"} → ${nameById.get(edge.toId) ?? "?"}`}</title>
            </line>
          );
        })}
        {nodes.map((node) => {
          const p = positions[node.id];
          if (!p) return null;
          const color = REALM_TYPE_COLOR[node.type as RealmEntityType];
          return (
            <g key={node.id} transform={`translate(${p.x} ${p.y})`}>
              <title>{`${node.name} · ${REALM_TYPE_LABEL[node.type as RealmEntityType]}${node.discovered ? "" : " (undiscovered)"}`}</title>
              <circle
                r={NODE_RADIUS}
                fill={color}
                fillOpacity={node.discovered ? 0.9 : 0.2}
                stroke={color}
                strokeWidth={2}
                strokeDasharray={node.discovered ? undefined : "4 3"}
              />
              <text
                y={NODE_RADIUS + 16}
                textAnchor="middle"
                className="fill-lore-text"
                fontSize={16}
              >
                {node.name.length > 18 ? `${node.name.slice(0, 17)}…` : node.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
