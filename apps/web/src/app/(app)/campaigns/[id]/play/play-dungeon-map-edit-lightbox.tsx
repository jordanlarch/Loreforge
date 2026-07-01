"use client";

import { DungeonMapEditor } from "@/app/(app)/realms/[id]/dungeon-map-editor";
import type { AuthoredDungeonFloor } from "@app/engine";
import { trpc } from "@/lib/trpc/client";

import { PlayLightbox } from "./play-lightbox";

type Props = {
  open: boolean;
  onClose: () => void;
  dungeonEntityId: string;
  floorIndex: number;
  onLayoutSaved: (entityData: Record<string, unknown>) => void;
};

export function PlayDungeonMapEditLightbox({
  open,
  onClose,
  dungeonEntityId,
  floorIndex,
  onLayoutSaved,
}: Props) {
  const entity = trpc.realms.get.useQuery(
    { id: dungeonEntityId },
    { enabled: open && Boolean(dungeonEntityId) },
  );

  async function handleSaved(floors: AuthoredDungeonFloor[]) {
    const data = (entity.data?.data ?? {}) as Record<string, unknown>;
    onLayoutSaved({ ...data, floors });
  }

  return (
    <PlayLightbox
      title="Edit dungeon map"
      open={open}
      onClose={onClose}
    >
      {entity.isLoading ? (
        <p className="text-sm text-lore-muted">Loading dungeon layout…</p>
      ) : entity.data?.type === "dungeon" ? (
        <DungeonMapEditor
          embedded
          initialFloorIndex={floorIndex}
          entityId={dungeonEntityId}
          name={entity.data.name}
          summary={entity.data.summary ?? ""}
          isStub={entity.data.isStub}
          data={entity.data.data as Record<string, unknown>}
          onSaved={handleSaved}
        />
      ) : (
        <p className="text-sm text-lore-muted">Dungeon entity not found.</p>
      )}
    </PlayLightbox>
  );
}
