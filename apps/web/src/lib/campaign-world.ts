/**
 * Campaign World tab helpers (#60). Browser-safe pure functions shared by the
 * World tab UI and the server graph query so the relationship-subset logic has
 * one tested definition.
 */

export type GraphEdgeLike = { fromId: string; toId: string };

/**
 * Keep only the edges whose both endpoints are inside `nodeIds` — i.e. the
 * relationships *within* a campaign's discovered/added world subset. Pure and
 * order-preserving so it's unit-testable and reusable on either side.
 */
export function edgesWithin<T extends GraphEdgeLike>(
  edges: readonly T[],
  nodeIds: Iterable<string>,
): T[] {
  const set = nodeIds instanceof Set ? nodeIds : new Set(nodeIds);
  return edges.filter((e) => set.has(e.fromId) && set.has(e.toId));
}
