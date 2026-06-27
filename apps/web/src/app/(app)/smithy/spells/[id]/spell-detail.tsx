"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  levelLine,
  SpellDefinitionMechanics,
  SpellDefinitionStats,
} from "@/components/spell-definition-panel";
import { SmithySpellForm } from "@/components/smithy-spell-form";
import { trpc } from "@/lib/trpc/client";
import { useRecordSmithyView } from "@/lib/use-record-smithy-view";

export function SpellDetail({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const query = trpc.smithy.getSpell.useQuery({ id });

  useEffect(() => {
    if (searchParams.get("edit") === "1") {
      setEditing(true);
    }
  }, [searchParams]);

  useRecordSmithyView("spell", id, query.data?.name);

  const remove = trpc.smithy.deleteSpell.useMutation({
    onSuccess: async () => {
      await utils.smithy.listSpells.invalidate();
      router.push("/smithy");
    },
  });

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-lore-muted">Loading…</div>
    );
  }

  const spell = query.data;
  if (!spell) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link
          href="/smithy"
          className="text-sm text-lore-muted hover:text-lore-text"
        >
          ← The Smithy
        </Link>
        <div className="mt-6 rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted">
          Spell not found.
        </div>
      </div>
    );
  }

  const def = spell.definition;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/smithy"
        className="text-sm text-lore-muted hover:text-lore-text"
      >
        ← The Smithy
      </Link>

      <header className="mt-3 flex flex-wrap items-end justify-between gap-4 border-b border-lore-border pb-6">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            {spell.name}
          </h1>
          <p className="mt-1 capitalize text-lore-muted">
            {levelLine(def)}
            {def.ritual && " · ritual"}
            {spell.source === "codex" && " · copied from Codex"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setEditing(true)}
            className="rounded border border-lore-border px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent"
          >
            Edit
          </button>
          <button
            onClick={() => remove.mutate({ id })}
            disabled={remove.isPending}
            className="rounded border border-red-500/40 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
          >
            {remove.isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </header>

      {editing ? (
        <SmithySpellForm
          mode="edit"
          spellId={id}
          initial={{
            definition: def,
            source: spell.source,
            copiedFromSlug: spell.copiedFromSlug,
          }}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
          className="mt-8"
        />
      ) : (
        <>
          <div className="mt-8">
            <SpellDefinitionStats def={def} />
          </div>

          <SpellDefinitionMechanics def={def} />

          <section className="mt-8">
            <h2 className="mb-3 text-xs uppercase tracking-widest text-lore-muted">
              Description
            </h2>
            {def.description ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {def.description}
              </p>
            ) : (
              <p className="text-sm text-lore-muted">No description yet.</p>
            )}
          </section>
        </>
      )}

      {remove.error && (
        <p className="mt-6 text-sm text-red-400">{remove.error.message}</p>
      )}
    </div>
  );
}
