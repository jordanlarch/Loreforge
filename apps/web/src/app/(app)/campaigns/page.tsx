import Link from "next/link";

export default function CampaignsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-display text-3xl font-semibold">Campaigns</h1>
      <p className="mt-4 text-lore-muted">
        The campaign workspace and live play arrive in P4.
      </p>

      <div className="mt-8 rounded-lg border border-lore-border bg-lore-surface p-6">
        <h2 className="font-display text-lg font-semibold">Battle map preview</h2>
        <p className="mt-2 text-sm text-lore-muted">
          A first look at the always-on tactical map: a fixture encounter you can
          play with. Drag the active token within its movement radius — the
          deterministic engine validates every move.
        </p>
        <Link
          href="/campaigns/sandbox/play"
          className="mt-4 inline-block rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent"
        >
          Open the sandbox battle →
        </Link>
      </div>
    </div>
  );
}
