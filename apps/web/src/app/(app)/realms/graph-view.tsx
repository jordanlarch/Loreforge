"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { trpc } from "@/lib/trpc/client";
import {
  REALM_ENTITY_TYPES,
  REALM_TYPE_COLOR,
  REALM_TYPE_LABEL,
  REL_LABEL,
  layoutGraph,
  type RealmEntityType,
  type RealmRelationshipKind,
} from "@/lib/realms";

const SIZE = 1000;
const NODE_RADIUS = 14;

export function GraphView() {
  const router = useRouter();
  const graph = trpc.realms.graph.useQuery();

  const { nodes, edges, positions } = useMemo(() => {
    const nodes = graph.data?.nodes ?? [];
    const edges = graph.data?.edges ?? [];
    const positions = layoutGraph(
      nodes.map((n) => ({ id: n.id })),
      edges.map((e) => ({ source: e.fromId, target: e.toId })),
      { width: SIZE, height: SIZE },
    );
    return { nodes, edges, positions };
  }, [graph.data]);

  if (graph.isLoading) {
    return <p className="text-sm text-lore-muted">Loading graph…</p>;
  }

  if (nodes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
        Your world graph is empty. Create a few entities and link them to see
        the web of your world.
      </div>
    );
  }

  const nameById = new Map(nodes.map((n) => [n.id, n.name]));

  return (
    <div className="space-y-4">
      <Legend />
      <div className="overflow-hidden rounded-lg border border-lore-border bg-lore-bg">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-[640px] w-full"
          role="img"
          aria-label="World relationship graph"
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
                <title>{`${nameById.get(edge.fromId) ?? "?"} — ${
                  REL_LABEL[edge.kind as RealmRelationshipKind] ?? edge.kind
                } → ${nameById.get(edge.toId) ?? "?"}`}</title>
              </line>
            );
          })}

          {nodes.map((node) => {
            const p = positions[node.id];
            if (!p) return null;
            const color = REALM_TYPE_COLOR[node.type as RealmEntityType];
            return (
              <g
                key={node.id}
                transform={`translate(${p.x} ${p.y})`}
                className="cursor-pointer"
                onClick={() => router.push(`/realms/${node.id}`)}
              >
                <title>{`${node.name} · ${
                  REALM_TYPE_LABEL[node.type as RealmEntityType]
                }`}</title>
                <circle
                  r={NODE_RADIUS}
                  fill={color}
                  fillOpacity={node.isStub ? 0.25 : 0.9}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray={node.isStub ? "4 3" : undefined}
                />
                <text
                  y={NODE_RADIUS + 16}
                  textAnchor="middle"
                  className="fill-lore-text"
                  fontSize={16}
                >
                  {truncate(node.name)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-xs text-lore-muted">
        {nodes.length} {nodes.length === 1 ? "entity" : "entities"} ·{" "}
        {edges.length} {edges.length === 1 ? "link" : "links"}. Showing your
        whole world. Click a node to open it; hover a line for the relationship.
      </p>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-lore-muted">
      {REALM_ENTITY_TYPES.map((type) => (
        <span key={type} className="flex items-center gap-1.5">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: REALM_TYPE_COLOR[type] }}
            aria-hidden
          />
          {REALM_TYPE_LABEL[type]}
        </span>
      ))}
    </div>
  );
}

function truncate(name: string): string {
  return name.length > 18 ? `${name.slice(0, 17)}…` : name;
}
