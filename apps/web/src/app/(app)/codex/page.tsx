import { Suspense } from "react";

import { CodexShell } from "./codex-shell";

export default function CodexPage() {
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
