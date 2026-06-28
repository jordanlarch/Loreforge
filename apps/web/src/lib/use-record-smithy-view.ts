"use client";

import { useEffect } from "react";

import { recordSmithyView } from "@/lib/codex-recently-viewed";

export function useRecordSmithyView(
  kind: "spell" | "item" | "toolbox",
  id: string,
  name: string | undefined | null,
) {
  useEffect(() => {
    if (!name?.trim()) return;
    recordSmithyView({ kind, id, name: name.trim() });
  }, [kind, id, name]);
}
