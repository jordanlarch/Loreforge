import { redirect } from "next/navigation";
import { Suspense } from "react";

import { codexCategoryPath, parseCodexCategorySegment } from "@/lib/codex-routes";

import { CodexShell } from "../codex-shell";

export default async function CodexCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: segment } = await params;
  if (!parseCodexCategorySegment(segment)) {
    redirect(codexCategoryPath("Spells"));
  }

  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-10 text-lore-muted">
          Loading Codex…
        </div>
      }
    >
      <CodexShell />
    </Suspense>
  );
}
