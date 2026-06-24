"use client";

import Link from "next/link";
import { useState } from "react";

import { buildCharacterSheet } from "@app/engine";

import { partitionRoster } from "@/lib/campaign-workspace";
import { trpc } from "@/lib/trpc/client";

type PartyMember = {
  membershipId: string;
  role: string;
  status: string;
  libraryVisibility: "library" | "campaign_only";
  id: string;
  name: string;
  species: string;
  background: string;
  classes: { class: string; level: number; subclass?: string }[];
  abilityScores: {
    str: number;
    dex: number;
    con: number;
    int: number;
    wis: number;
    cha: number;
  };
  maxHp: number;
  baseAc: number;
  speed: number;
  saveProficiencies: ("str" | "dex" | "con" | "int" | "wis" | "cha")[];
  skillProficiencies: string[];
};

/**
 * Party tab (#61): the campaign-scoped roster built on the `campaign_characters`
 * membership link. Add/remove owned characters, see PCs vs companions vs bench,
 * and jump into the live session. Card stats are derived through `@app/engine`
 * (no math in the app layer).
 */
export function PartyTab({ campaignId }: { campaignId: string }) {
  const utils = trpc.useUtils();
  const party = trpc.campaigns.party.useQuery({ campaignId });
  const allCharacters = trpc.characters.list.useQuery();

  const [addId, setAddId] = useState("");

  async function refresh() {
    await Promise.all([
      utils.campaigns.party.invalidate({ campaignId }),
      utils.campaigns.get.invalidate({ id: campaignId }),
    ]);
  }

  const add = trpc.characters.addToCampaign.useMutation({
    onSuccess: async () => {
      setAddId("");
      await refresh();
    },
  });
  const remove = trpc.characters.removeFromCampaign.useMutation({
    onSuccess: refresh,
  });
  const addToLibrary = trpc.characters.addToLibrary.useMutation({
    onSuccess: async () => {
      await Promise.all([
        refresh(),
        utils.characters.list.invalidate(),
      ]);
    },
  });

  const members = (party.data ?? []) as PartyMember[];
  const memberIds = new Set(members.map((m) => m.id));
  const available = (allCharacters.data ?? []).filter(
    (c) => !memberIds.has(c.id),
  );
  const { pcs, companions, bench } = partitionRoster(members);

  function onAdd(role: "pc" | "companion") {
    if (!addId) return;
    add.mutate({ characterId: addId, campaignId, role });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* —— Header / actions —— */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Party Roster</h2>
        <div className="flex flex-wrap items-center gap-2">
          {available.length > 0 ? (
            <>
              <select
                value={addId}
                onChange={(e) => setAddId(e.target.value)}
                className="rounded border border-lore-border bg-lore-bg px-3 py-1.5 text-sm outline-none focus:border-lore-accent"
              >
                <option value="">Add a character…</option>
                {available.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onAdd("pc")}
                disabled={!addId || add.isPending}
                className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
              >
                {add.isPending ? "Adding…" : "Add to party"}
              </button>
              <button
                type="button"
                onClick={() => onAdd("companion")}
                disabled={!addId || add.isPending}
                className="rounded border border-lore-border px-3 py-1.5 text-sm transition-colors hover:border-lore-accent disabled:opacity-40"
              >
                Add as companion
              </button>
            </>
          ) : (
            <Link
              href="/characters/new"
              className="rounded border border-lore-border px-3 py-1.5 text-sm transition-colors hover:border-lore-accent"
            >
              New character
            </Link>
          )}
          <Link
            href={`/campaigns/${campaignId}/play`}
            className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-1.5 text-sm font-medium text-lore-text transition-colors hover:border-lore-accent"
          >
            ▶ Play Now
          </Link>
        </div>
      </div>

      {add.error && (
        <p className="text-sm text-red-400">{add.error.message}</p>
      )}

      {party.isLoading ? (
        <p className="text-sm text-lore-muted">Loading party…</p>
      ) : members.length === 0 ? (
        <div className="rounded-lg border border-dashed border-lore-border p-12 text-center text-lore-muted">
          No characters in this campaign yet. Add one above to build your party.
        </div>
      ) : (
        <>
          <RosterSection
            title="Player Characters"
            members={pcs}
            onRemove={(characterId) =>
              remove.mutate({ characterId, campaignId })
            }
            onAddToLibrary={(characterId) =>
              addToLibrary.mutate({ characterId })
            }
            addingToLibrary={addToLibrary.isPending}
            removing={remove.isPending}
          />
          {companions.length > 0 && (
            <RosterSection
              title="Companions & Allies"
              members={companions}
              onRemove={(characterId) =>
                remove.mutate({ characterId, campaignId })
              }
              onAddToLibrary={(characterId) =>
                addToLibrary.mutate({ characterId })
              }
              addingToLibrary={addToLibrary.isPending}
              removing={remove.isPending}
            />
          )}
          {bench.length > 0 && (
            <RosterSection
              title="Bench"
              members={bench}
              onRemove={(characterId) =>
                remove.mutate({ characterId, campaignId })
              }
              onAddToLibrary={(characterId) =>
                addToLibrary.mutate({ characterId })
              }
              addingToLibrary={addToLibrary.isPending}
              removing={remove.isPending}
            />
          )}
        </>
      )}

      {/* —— Shared resources (minimal stub) —— */}
      <section className="rounded-lg border border-lore-border bg-lore-surface p-5">
        <h3 className="text-xs uppercase tracking-widest text-lore-muted">
          Shared Party Resources
        </h3>
        <p className="mt-2 text-sm text-lore-muted">
          A shared currency pool and party inventory land in a later slice.
        </p>
      </section>
    </div>
  );
}

function RosterSection({
  title,
  members,
  onRemove,
  onAddToLibrary,
  addingToLibrary,
  removing,
}: {
  title: string;
  members: PartyMember[];
  onRemove: (characterId: string) => void;
  onAddToLibrary: (characterId: string) => void;
  addingToLibrary: boolean;
  removing: boolean;
}) {
  return (
    <section>
      <h3 className="mb-3 text-xs uppercase tracking-widest text-lore-muted">
        {title}
      </h3>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => {
          const sheet = buildCharacterSheet(member);
          return (
            <li
              key={member.membershipId}
              className="flex h-full flex-col gap-3 rounded-lg border border-lore-border bg-lore-surface p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-display text-xl">{sheet.name}</span>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded bg-lore-bg px-2 py-0.5 text-xs text-lore-accent">
                    Lvl {sheet.level}
                  </span>
                  {member.libraryVisibility === "campaign_only" && (
                    <span className="rounded border border-lore-border px-1.5 py-0.5 text-[10px] text-lore-muted">
                      Campaign only
                    </span>
                  )}
                </div>
              </div>
              <span className="text-sm text-lore-muted">
                {[sheet.species, sheet.classLine].filter(Boolean).join(" · ")}
              </span>
              <div className="flex gap-4 text-sm text-lore-muted">
                <span>AC {sheet.ac}</span>
                <span>
                  HP {sheet.hp.current}/{sheet.hp.max}
                </span>
                <span>Speed {sheet.speed}</span>
              </div>
              <div className="mt-auto flex flex-wrap items-center gap-3 pt-1 text-sm">
                <Link
                  href={`/characters/${member.id}`}
                  className="text-lore-accent hover:underline"
                >
                  Open Sheet
                </Link>
                {member.libraryVisibility === "campaign_only" && (
                  <button
                    type="button"
                    onClick={() => onAddToLibrary(member.id)}
                    disabled={addingToLibrary}
                    className="text-lore-accent transition-colors hover:underline disabled:opacity-40"
                  >
                    {addingToLibrary ? "Adding…" : "Add to My Characters"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(member.id)}
                  disabled={removing}
                  className="text-lore-muted transition-colors hover:text-red-400 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
