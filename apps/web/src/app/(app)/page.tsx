import { getEngineHealth } from "@app/engine";

import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const engine = getEngineHealth();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-display text-4xl font-semibold tracking-tight">
        Welcome back
      </h1>
      <p className="mt-4 max-w-xl text-lore-muted">
        P0 Home shell — authenticated landing. Characters, Codex, and play
        surfaces ship in P1+.
      </p>
      <div className="mt-10 rounded-lg border border-lore-border bg-lore-surface p-6 text-sm">
        <p>
          <span className="text-lore-muted">Signed in as </span>
          {user?.email ?? "—"}
        </p>
        <p className="mt-2 text-lore-muted">
          Engine: {engine.version} (ready: {String(engine.ready)})
        </p>
      </div>
    </div>
  );
}
