"use client";

import { useEffect } from "react";

import type { CodexCategory } from "@/lib/codex-categories";
import { recordCodexView } from "@/lib/codex-recently-viewed";

/** Append a Codex detail view to Recently Viewed when data is loaded (CODEX-4). */
export function useRecordCodexView(
  category: CodexCategory,
  slug: string,
  name: string | undefined | null,
) {
  useEffect(() => {
    if (!name?.trim()) return;
    recordCodexView({ category, slug, name: name.trim() });
  }, [category, slug, name]);
}
