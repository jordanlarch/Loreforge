"use client";

import { PrepLightbox } from "./prep-lightbox";
import { RealmEntityDetail } from "@/app/(app)/realms/[id]/realm-detail";

/**
 * Realms entity editor opened from prep Locations (CAMP-UX UX-6). Structural
 * edits persist to the global Realms library entity.
 */
export function RealmsEditLightbox({
  entityId,
  entityName,
  open,
  onClose,
}: {
  entityId: string;
  entityName: string;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <PrepLightbox
      title={`Edit stub — ${entityName}`}
      open={open}
      onClose={onClose}
      wide
    >
      <RealmEntityDetail id={entityId} embedded onClose={onClose} />
    </PrepLightbox>
  );
}
