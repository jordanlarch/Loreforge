import Link from "next/link";

import { count } from "drizzle-orm";

import { codexSpells, getDb } from "@app/db";
import { getEngineHealth } from "@app/engine";

import { createClient } from "@/lib/supabase/server";

const SURFACES = [
  {
    href: "/tutorial",
    title: "Tutorial",
    body: "Play \"The Lantern's Last Flicker\" — a guided intro to Loreforge.",
    ready: true,
  },
  {
    href: "/characters",
    title: "Characters",
    body: "Read-only sheets on fixture data. Creation in P2.",
    ready: true,
  },
  {
    href: "/codex",
    title: "Codex",
    body: "Browse the official 5E SRD 5.2 spell reference.",
    ready: true,
  },
  {
    href: "/realms",
    title: "Realms",
    body: "Worldbuilding entities and generators. P3+.",
    ready: false,
  },
  {
    href: "/campaigns",
    title: "Campaigns",
    body: "Campaign workspace and live play. P4.",
    ready: false,
  },
  {
    href: "/smithy",
    title: "The Smithy",
    body: "Homebrew items, spells, and monsters. P2+.",
    ready: false,
  },
] as const;

async function getSpellCount(): Promise<number | null> {
  try {
    const db = getDb();
    const [row] = await db.select({ value: count() }).from(codexSpells);
    return row?.value ?? 0;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const engine = getEngineHealth();
  const spellCount = await getSpellCount();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="font-display text-4xl font-semibold tracking-tight">
        Welcome back
      </h1>
      <p className="mt-3 max-w-xl text-lore-muted">
        Loreforge is in active build (P1 — Engine Skeleton + App Shell). The
        deterministic engine and the Codex reference are live below.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SURFACES.map((surface) => (
          <Link
            key={surface.href}
            href={surface.href}
            className={`group flex flex-col gap-2 rounded-lg border p-5 transition-colors ${
              surface.ready
                ? "border-lore-border bg-lore-surface hover:border-lore-accent"
                : "border-lore-border/60 bg-lore-surface/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-xl">{surface.title}</span>
              {!surface.ready && (
                <span className="rounded-full border border-lore-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-lore-muted">
                  soon
                </span>
              )}
            </div>
            <span className="text-sm text-lore-muted">{surface.body}</span>
          </Link>
        ))}
      </div>

      <div className="mt-10 rounded-lg border border-lore-border bg-lore-surface p-6 text-sm">
        <h2 className="mb-3 text-xs uppercase tracking-widest text-lore-muted">
          System Status
        </h2>
        <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <Row label="Signed in as" value={user?.email ?? "—"} />
          <Row
            label="Engine"
            value={`${engine.version} (ready: ${String(engine.ready)})`}
          />
          <Row
            label="Codex spells ingested"
            value={spellCount == null ? "unavailable" : String(spellCount)}
          />
        </dl>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-lore-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
