"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { trpc } from "@/lib/trpc/client";

type CreatePath = "quick" | "guided" | "empty";

/**
 * The three-path campaign creation modal (#62): Quick Forge (single-prompt
 * world via the Realms cascade), Guided Setup (6-step wizard), and Empty World
 * (bare workspace). Every path lands in `/campaigns/[id]`.
 */
export function CampaignCreateModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const forgeStatus = trpc.campaigns.forgeStatus.useQuery();
  const [path, setPath] = useState<CreatePath | null>(null);

  async function land(id: string) {
    await utils.campaigns.list.invalidate();
    router.push(`/campaigns/${id}`);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-lore-border bg-lore-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-2xl">
            {path === null ? "Begin a New Campaign" : "New Campaign"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-lore-muted hover:text-lore-text"
          >
            Close
          </button>
        </div>

        {path === null ? (
          <PathPicker
            onPick={setPath}
            forgeConfigured={forgeStatus.data?.configured ?? true}
          />
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setPath(null)}
              className="mb-4 text-sm text-lore-muted hover:text-lore-text"
            >
              ← Choose a different path
            </button>
            {path === "quick" ? (
              <QuickForge
                forgeConfigured={forgeStatus.data?.configured ?? true}
                onDone={land}
              />
            ) : path === "guided" ? (
              <GuidedSetup
                forgeConfigured={forgeStatus.data?.configured ?? true}
                onDone={land}
              />
            ) : (
              <EmptyWorld onDone={land} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PathPicker({
  onPick,
  forgeConfigured,
}: {
  onPick: (p: CreatePath) => void;
  forgeConfigured: boolean;
}) {
  const cards: {
    id: CreatePath;
    icon: string;
    title: string;
    blurb: string;
  }[] = [
    {
      id: "quick",
      icon: "⚡",
      title: "Quick Forge",
      blurb: "One prompt. The AI forges a whole starting world in seconds.",
    },
    {
      id: "guided",
      icon: "📜",
      title: "Guided Setup",
      blurb: "A 6-step wizard: concept, region, settlements, faction, party.",
    },
    {
      id: "empty",
      icon: "📭",
      title: "Empty World",
      blurb: "A bare workspace. Build or import from Realms yourself.",
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={() => onPick(card.id)}
          className="flex flex-col gap-2 rounded-lg border border-lore-border bg-lore-bg p-4 text-left transition-colors hover:border-lore-accent"
        >
          <span className="text-2xl">{card.icon}</span>
          <span className="font-display text-lg">{card.title}</span>
          <span className="text-sm text-lore-muted">{card.blurb}</span>
          {(card.id === "quick" || card.id === "guided") && !forgeConfigured && (
            <span className="mt-1 text-xs text-amber-400">
              AI forging unavailable — creates an empty world.
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-widest text-lore-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm outline-none focus:border-lore-accent";

function ForgeUnavailableNote() {
  return (
    <p className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
      AI world-forging isn&apos;t configured in this environment. Your campaign
      will be created empty — add entities from Realms in the World tab.
    </p>
  );
}

/** Coerce controlled input values — never let `undefined` stringify into the field. */
function inputValue(value: string): string {
  return value ?? "";
}

function QuickForge({
  forgeConfigured,
  onDone,
}: {
  forgeConfigured: boolean;
  onDone: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [pitch, setPitch] = useState("");
  const forge = trpc.campaigns.forge.useMutation({
    onSuccess: (res) => onDone(res.id),
  });

  const canForge = name.trim().length > 0 && !forge.isPending;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canForge) return;
        forge.mutate({
          name: name.trim(),
          description: pitch.trim(),
          regionConcept: pitch.trim() || undefined,
        });
      }}
      className="flex flex-col gap-4"
    >
      {!forgeConfigured && <ForgeUnavailableNote />}
      <Field label="Campaign name">
        <input
          value={inputValue(name)}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          className={inputCls}
          placeholder="The Frozen Marches"
        />
      </Field>
      <Field label="Pitch your world in a paragraph">
        <textarea
          value={inputValue(pitch)}
          onChange={(e) => setPitch(e.target.value)}
          maxLength={2000}
          rows={5}
          className={inputCls}
          placeholder="A frozen coastal frontier where settlers mine mana-ice while frost giants stir beneath the permafrost. Grim but heroic."
        />
      </Field>
      {forge.error && (
        <p className="text-sm text-red-400">{forge.error.message}</p>
      )}
      <button
        type="submit"
        disabled={!canForge}
        className="self-start rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
      >
        {forge.isPending
          ? "Forging the world…"
          : forgeConfigured
            ? "⚒ Quick-Forge the World"
            : "Create campaign"}
      </button>
    </form>
  );
}

const GUIDED_STEPS = [
  "Concept",
  "Region",
  "Settlements",
  "Faction",
  "Party",
  "Opening Scene",
] as const;

function GuidedSetup({
  forgeConfigured,
  onDone,
}: {
  forgeConfigured: boolean;
  onDone: (id: string) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [pitch, setPitch] = useState("");
  const [regionConcept, setRegionConcept] = useState("");
  const [factionConcept, setFactionConcept] = useState("");
  const [openingScene, setOpeningScene] = useState("");

  const forge = trpc.campaigns.forge.useMutation({
    onSuccess: (res) => onDone(res.id),
  });

  const isLast = step === GUIDED_STEPS.length - 1;
  const canAdvance = step > 0 || name.trim().length > 0;

  function finish() {
    const description = [pitch.trim(), openingScene.trim()]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 2000);
    forge.mutate({
      name: name.trim(),
      description,
      regionConcept: regionConcept.trim() || undefined,
      factionConcept: factionConcept.trim() || undefined,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Stepper */}
      <ol className="flex flex-wrap gap-2 text-xs">
        {GUIDED_STEPS.map((label, i) => (
          <li
            key={label}
            className={`rounded-full border px-2.5 py-1 ${
              i === step
                ? "border-lore-accent text-lore-accent"
                : i < step
                  ? "border-lore-border text-lore-text"
                  : "border-lore-border text-lore-muted"
            }`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="flex flex-col gap-4">
          <Field label="Campaign name">
            <input
              value={inputValue(name)}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              className={inputCls}
              placeholder="The Frozen Marches"
            />
          </Field>
          <Field label="Pitch paragraph">
            <textarea
              value={inputValue(pitch)}
              onChange={(e) => setPitch(e.target.value)}
              maxLength={2000}
              rows={4}
              className={inputCls}
              placeholder="The premise, tone, and the party's place in it."
            />
          </Field>
        </div>
      )}

      {step === 1 && (
        <Field label="Region concept — the AI forges this region and its cascade">
          <textarea
            value={regionConcept}
            onChange={(e) => setRegionConcept(e.target.value)}
            maxLength={2000}
            rows={5}
            className={inputCls}
            placeholder="A glacial coastline of fjord-towns and mana-ice mines, ruled by an uneasy mining council."
          />
        </Field>
      )}

      {step === 2 && (
        <p className="text-sm text-lore-muted">
          Settlements are forged automatically as part of the region cascade —
          the generator seeds towns and NPCs linked to your region. You can add
          or expand more from the World tab afterward.
        </p>
      )}

      {step === 3 && (
        <Field label="Primary faction concept (optional)">
          <textarea
            value={factionConcept}
            onChange={(e) => setFactionConcept(e.target.value)}
            maxLength={2000}
            rows={4}
            className={inputCls}
            placeholder="The Frost-Binders — a cabal of rime-mages who claim the deep ice as sacred."
          />
        </Field>
      )}

      {step === 4 && (
        <p className="text-sm text-lore-muted">
          Party slots are managed on the campaign&apos;s Party tab once the
          workspace opens — add your characters or reserve seats for invitees
          there.
        </p>
      )}

      {step === 5 && (
        <Field label="Opening scene / arrival prompt (optional)">
          <textarea
            value={openingScene}
            onChange={(e) => setOpeningScene(e.target.value)}
            maxLength={2000}
            rows={4}
            className={inputCls}
            placeholder="The party disembarks at a half-frozen dock as the last supply ship of the season pulls away…"
          />
        </Field>
      )}

      {!forgeConfigured && (regionConcept || factionConcept) && (
        <ForgeUnavailableNote />
      )}
      {forge.error && (
        <p className="text-sm text-red-400">{forge.error.message}</p>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || forge.isPending}
          className="rounded border border-lore-border px-3 py-2 text-sm text-lore-muted transition-colors hover:text-lore-text disabled:opacity-40"
        >
          ← Back
        </button>
        {isLast ? (
          <button
            type="button"
            onClick={finish}
            disabled={!name.trim() || forge.isPending}
            className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
          >
            {forge.isPending ? "Building…" : "Save & Enter Workspace"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance}
            className="rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyWorld({ onDone }: { onDone: (id: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [pitch, setPitch] = useState("");
  const create = trpc.campaigns.create.useMutation({
    onSuccess: (campaign) => {
      if (campaign) return onDone(campaign.id);
    },
  });
  const canCreate = name.trim().length > 0 && !create.isPending;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canCreate) return;
        create.mutate({ name: name.trim(), description: pitch.trim() });
      }}
      className="flex flex-col gap-4"
    >
      <Field label="Campaign name">
        <input
          value={inputValue(name)}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          className={inputCls}
          placeholder="My new campaign"
        />
      </Field>
      <Field label="Pitch (optional)">
        <textarea
          value={inputValue(pitch)}
          onChange={(e) => setPitch(e.target.value)}
          maxLength={2000}
          rows={4}
          className={inputCls}
          placeholder="A one-line or one-paragraph premise."
        />
      </Field>
      {create.error && (
        <p className="text-sm text-red-400">{create.error.message}</p>
      )}
      <button
        type="submit"
        disabled={!canCreate}
        className="self-start rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-40"
      >
        {create.isPending ? "Creating…" : "Create empty world"}
      </button>
    </form>
  );
}
