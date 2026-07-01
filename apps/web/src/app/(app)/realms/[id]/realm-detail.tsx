"use client";

import Link from "next/link";
import { useState } from "react";

import { buildCharacterSheet, type Ability } from "@app/engine";

import { trpc } from "@/lib/trpc/client";
import {
  REALM_TYPE_LABEL,
  npcToSheetInput,
  realmSections,
  type NpcData,
  type RealmEntityType,
  type RealmFieldDescriptor,
} from "@/lib/realms";

import { EntityForm } from "../entity-form";
import { DungeonMapEditor } from "./dungeon-map-editor";
import { QuestsSection } from "./quests-section";
import { RelationshipPanel } from "./relationship-panel";

const ABILITY_LABELS: Record<Ability, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

type GenCandidate = { summary: string; data: Record<string, unknown> };

export function RealmEntityDetail({
  id,
  embedded = false,
  onClose,
}: {
  id: string;
  /** When true, render inside a prep lightbox (no back nav / page chrome). */
  embedded?: boolean;
  onClose?: () => void;
}) {
  const query = trpc.realms.get.useQuery({ id });
  const utils = trpc.useUtils();
  const generatorStatus = trpc.realms.generatorStatus.useQuery();

  const [editing, setEditing] = useState(false);
  const [candidate, setCandidate] = useState<GenCandidate | null>(null);

  async function invalidate() {
    await Promise.all([
      utils.realms.get.invalidate({ id }),
      utils.realms.counts.invalidate(),
      utils.realms.list.invalidate(),
    ]);
  }

  const expand = trpc.realms.expandStub.useMutation({
    onSuccess: async () => {
      await invalidate();
    },
  });
  const regenerate = trpc.realms.regenerate.useMutation({
    onSuccess: (data) => setCandidate(data),
  });
  const accept = trpc.realms.update.useMutation({
    onSuccess: async () => {
      setCandidate(null);
      await invalidate();
    },
  });

  if (query.isLoading) {
    return (
      <div
        className={
          embedded ? "text-lore-muted" : "mx-auto max-w-5xl px-4 py-10 text-lore-muted"
        }
      >
        Loading…
      </div>
    );
  }

  const entity = query.data;
  if (!entity) {
    return (
      <div className={embedded ? "" : "mx-auto max-w-5xl px-4 py-10"}>
        {!embedded ? <BackLink /> : null}
        <div
          className={`rounded-lg border border-dashed border-lore-border p-10 text-center text-lore-muted ${
            embedded ? "mt-2" : "mt-6"
          }`}
        >
          Entity not found.
        </div>
      </div>
    );
  }

  const type = entity.type as RealmEntityType;
  const configured = generatorStatus.data?.configured ?? true;
  const genError = expand.error ?? regenerate.error ?? accept.error;

  return (
    <div className={embedded ? "" : "mx-auto max-w-5xl px-4 py-10"}>
      {!embedded ? <BackLink /> : null}

      <header
        className={`flex flex-wrap items-start justify-between gap-4 border-b border-lore-border pb-6 ${
          embedded ? "mt-0" : "mt-3"
        }`}
      >
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-4xl font-semibold tracking-tight">
              {entity.name}
            </h1>
            {entity.isStub && (
              <span
                title="A placeholder awaiting generator expansion."
                className="rounded bg-lore-bg px-2 py-0.5 text-xs text-lore-muted"
              >
                Stub
              </span>
            )}
          </div>
          <p className="mt-1 text-xs uppercase tracking-wide text-lore-muted">
            {REALM_TYPE_LABEL[type]}
          </p>
          {entity.summary && (
            <p className="mt-3 max-w-2xl text-lore-muted">{entity.summary}</p>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg border border-lore-accent bg-lore-accent-dim px-4 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent"
            >
              Edit
            </button>
            {entity.isStub ? (
              <ExpandButton
                configured={configured}
                pending={expand.isPending}
                onClick={() => expand.mutate({ id: entity.id })}
              />
            ) : (
              <RegenerateButton
                configured={configured}
                pending={regenerate.isPending}
                onClick={() => regenerate.mutate({ id: entity.id })}
              />
            )}
          </div>
        )}
      </header>

      {genError && (
        <p className="mt-4 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {genError.message}
        </p>
      )}

      {candidate && !editing && (
        <RegeneratePreview
          type={type}
          name={entity.name}
          candidate={candidate}
          accepting={accept.isPending}
          onAccept={() =>
            accept.mutate({
              id: entity.id,
              type,
              name: entity.name,
              summary: candidate.summary,
              isStub: false,
              data: candidate.data,
            })
          }
          onDiscard={() => setCandidate(null)}
        />
      )}

      {editing ? (
        <div className="mt-8">
          <EntityForm
            mode="edit"
            type={type}
            entityId={entity.id}
            initial={{
              name: entity.name,
              summary: entity.summary,
              isStub: entity.isStub,
              data: entity.data,
            }}
            onDone={() => setEditing(false)}
          />
        </div>
      ) : type === "npc" ? (
        <NpcStatBlock
          id={entity.id}
          name={entity.name}
          data={entity.data}
          onRegenerate={
            configured && !entity.isStub
              ? (fields) => regenerate.mutate({ id: entity.id, fields })
              : undefined
          }
          regenerating={regenerate.isPending}
        />
      ) : (
        <>
          <QuestsSection
            entityId={entity.id}
            entityType={type}
            name={entity.name}
            summary={entity.summary}
            isStub={entity.isStub}
            data={entity.data as Record<string, unknown>}
          />
          {type === "dungeon" ? (
            <DungeonMapEditor
              entityId={entity.id}
              name={entity.name}
              summary={entity.summary}
              isStub={entity.isStub}
              data={entity.data as Record<string, unknown>}
            />
          ) : null}
          <DescriptiveView
            type={type}
            data={entity.data}
            onRegenerate={
              configured && !entity.isStub
                ? (fields) => regenerate.mutate({ id: entity.id, fields })
                : undefined
            }
            regenerating={regenerate.isPending}
          />
        </>
      )}

      {!editing && <RelationshipPanel entityId={entity.id} />}
    </div>
  );
}

function RegeneratePreview({
  type,
  name,
  candidate,
  accepting,
  onAccept,
  onDiscard,
}: {
  type: RealmEntityType;
  name: string;
  candidate: GenCandidate;
  accepting: boolean;
  onAccept: () => void;
  onDiscard: () => void;
}) {
  return (
    <section className="mt-8 rounded-lg border border-lore-accent/50 bg-lore-surface p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg">
          <span className="text-lore-accent">✨</span> Regenerated preview
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDiscard}
            className="rounded border border-lore-border px-3 py-1.5 text-sm text-lore-muted transition-colors hover:text-lore-text"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={accepting}
            className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-50"
          >
            {accepting ? "Applying…" : "Accept changes"}
          </button>
        </div>
      </div>
      {candidate.summary && (
        <p className="mb-2 text-sm text-lore-muted">{candidate.summary}</p>
      )}
      <p className="mb-4 text-xs text-lore-muted">
        Review the proposed content below. Accepting replaces the current values;
        your manual edits are untouched until you accept.
      </p>
      {type === "npc" ? (
        <NpcStatBlock id="preview" name={name} data={candidate.data} />
      ) : (
        <DescriptiveView
          type={type as Exclude<RealmEntityType, "npc">}
          data={candidate.data}
        />
      )}
    </section>
  );
}

function ExpandButton({
  configured,
  pending,
  onClick,
}: {
  configured: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  if (!configured) {
    return (
      <button
        type="button"
        disabled
        title="AI generation isn't configured (set ANTHROPIC_API_KEY)."
        className="cursor-not-allowed rounded-lg border border-lore-border px-4 py-1.5 text-sm text-lore-muted opacity-60"
      >
        Expand with Generator
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded-lg border border-lore-accent bg-lore-accent-dim px-4 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-50"
    >
      {pending ? "Expanding…" : "✨ Expand with Generator"}
    </button>
  );
}

function RegenerateButton({
  configured,
  pending,
  onClick,
}: {
  configured: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  if (!configured) {
    return (
      <button
        type="button"
        disabled
        title="AI generation isn't configured (set ANTHROPIC_API_KEY)."
        className="cursor-not-allowed rounded-lg border border-lore-border px-4 py-1.5 text-sm text-lore-muted opacity-60"
      >
        Regenerate
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="rounded-lg border border-lore-border px-4 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-50"
    >
      {pending ? "Regenerating…" : "✨ Regenerate"}
    </button>
  );
}

function RegenButton({
  onClick,
  pending,
  title = "Regenerate this section",
}: {
  onClick: () => void;
  pending: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title={title}
      aria-label={title}
      className="rounded border border-lore-border px-2 py-0.5 text-xs text-lore-muted transition-colors hover:border-lore-accent hover:text-lore-text disabled:opacity-50"
    >
      ⟳
    </button>
  );
}

/** Whether a descriptor has a meaningful value in `data` (for hide-empty). */
function hasFieldValue(field: RealmFieldDescriptor, data: Record<string, unknown>): boolean {
  const v = data[field.key];
  if (field.kind === "number") return typeof v === "number" && v > 0;
  if (field.kind === "list") {
    return Array.isArray(v) && v.some((s) => String(s ?? "").trim() !== "");
  }
  if (field.kind === "group") return Array.isArray(v) && v.length > 0;
  return typeof v === "string" && v.trim() !== "";
}

function DescriptiveView({
  type,
  data,
  onRegenerate,
  regenerating = false,
}: {
  type: Exclude<RealmEntityType, "npc">;
  data: Record<string, unknown>;
  onRegenerate?: (fields: string[]) => void;
  regenerating?: boolean;
}) {
  const sections = realmSections(type);
  const [active, setActive] = useState(0);

  const anyVisible = sections.some((s) =>
    s.fields.some((f) => hasFieldValue(f, data)),
  );
  if (!anyVisible) {
    return (
      <p className="mt-8 text-sm text-lore-muted">
        No details yet — use Edit to fill them in.
      </p>
    );
  }

  // Single-section types (region, tavern, …) render without a tab bar so they
  // look exactly as before; only multi-section types (Settlement) show tabs.
  const tabbed = sections.length > 1;
  const current = sections[Math.min(active, sections.length - 1)]!;

  return (
    <div className="mt-8">
      {tabbed && (
        <div
          role="tablist"
          aria-label="Detail sections"
          className="flex flex-wrap gap-1 border-b border-lore-border"
        >
          {sections.map((s, i) => {
            const filled = s.fields.some((f) => hasFieldValue(f, data));
            return (
              <button
                key={s.name}
                type="button"
                role="tab"
                aria-selected={i === active}
                onClick={() => setActive(i)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
                  i === active
                    ? "border-lore-accent text-lore-text"
                    : "border-transparent text-lore-muted hover:text-lore-text"
                }`}
              >
                {s.name}
                {!filled && <span className="ml-1 text-lore-muted/60">·</span>}
              </button>
            );
          })}
        </div>
      )}

      <SectionBody
        key={current.name}
        section={current}
        data={data}
        onRegenerate={onRegenerate}
        regenerating={regenerating}
      />
    </div>
  );
}

function SectionBody({
  section,
  data,
  onRegenerate,
  regenerating = false,
}: {
  section: { name: string; fields: readonly RealmFieldDescriptor[] };
  data: Record<string, unknown>;
  onRegenerate?: (fields: string[]) => void;
  regenerating?: boolean;
}) {
  const visible = section.fields.filter((f) => hasFieldValue(f, data));

  return (
    <div className="pt-5">
      {onRegenerate && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => onRegenerate(section.fields.map((f) => f.key))}
            disabled={regenerating}
            className="rounded border border-lore-border px-3 py-1 text-xs text-lore-muted transition-colors hover:border-lore-accent hover:text-lore-text disabled:opacity-50"
          >
            {regenerating ? "Regenerating…" : `⟳ Regenerate ${section.name}`}
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="text-sm text-lore-muted">
          Nothing here yet — use Edit to fill in {section.name}.
        </p>
      ) : (
        <dl className="grid gap-4 sm:grid-cols-2">
          {visible.map((f) => (
            <div
              key={f.key}
              className={`rounded-lg border border-lore-border bg-lore-surface p-4 ${
                f.kind === "textarea" || f.kind === "list" || f.kind === "group"
                  ? "sm:col-span-2"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <dt className="text-xs uppercase tracking-wide text-lore-muted">
                  {f.label}
                </dt>
                {onRegenerate && (
                  <RegenButton
                    onClick={() => onRegenerate([f.key])}
                    pending={regenerating}
                    title={`Regenerate ${f.label}`}
                  />
                )}
              </div>
              <dd className="mt-1">
                <FieldValue field={f} value={data[f.key]} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function FieldValue({
  field,
  value,
}: {
  field: RealmFieldDescriptor;
  value: unknown;
}) {
  if (field.kind === "list") {
    const items = Array.isArray(value)
      ? value.map((v) => String(v ?? "").trim()).filter(Boolean)
      : [];
    return (
      <ul className="list-disc space-y-1 pl-5">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    );
  }

  if (field.kind === "group") {
    const items = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
    return (
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li
            key={i}
            className="rounded border border-lore-border bg-lore-bg p-3"
          >
            {(field.fields ?? []).map((sub) => {
              const sv = String(item?.[sub.key] ?? "").trim();
              if (!sv) return null;
              return (
                <div key={sub.key} className="mb-1 last:mb-0">
                  <span className="text-xs uppercase tracking-wide text-lore-muted">
                    {sub.label}:{" "}
                  </span>
                  <span
                    className={sub.kind === "textarea" ? "whitespace-pre-wrap" : ""}
                  >
                    {sv}
                  </span>
                </div>
              );
            })}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <span className={field.kind === "textarea" ? "whitespace-pre-wrap" : ""}>
      {String(value ?? "")}
    </span>
  );
}

function NpcStatBlock({
  id,
  name,
  data,
  onRegenerate,
  regenerating = false,
}: {
  id: string;
  name: string;
  data: Record<string, unknown>;
  onRegenerate?: (fields: string[]) => void;
  regenerating?: boolean;
}) {
  const sheet = buildCharacterSheet(npcToSheetInput({ id, name, data }));
  const npc = data as Partial<NpcData>;

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-3 text-center">
        <Stat label="AC" value={sheet.ac} />
        <Stat label="HP" value={sheet.hp.max} />
        <Stat label="Speed" value={`${sheet.speed} ft`} />
        <Stat label="Init" value={signed(sheet.initiative)} />
        <Stat label="Prof" value={signed(sheet.proficiencyBonus)} />
        {sheet.classLine && <Stat label="Class" value={sheet.classLine} />}
        {npc.alignment && <Stat label="Alignment" value={npc.alignment} />}
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-xs uppercase tracking-widest text-lore-muted">
            Ability Scores
          </h2>
          {onRegenerate && (
            <RegenButton
              onClick={() => onRegenerate(["abilityScores"])}
              pending={regenerating}
              title="Regenerate ability scores"
            />
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {(Object.keys(ABILITY_LABELS) as Ability[]).map((ability) => (
            <div
              key={ability}
              className="rounded-lg border border-lore-border bg-lore-surface p-4 text-center"
            >
              <div className="text-xs uppercase tracking-wide text-lore-muted">
                {ability}
              </div>
              <div className="mt-1 font-display text-3xl">
                {signed(sheet.abilityModifiers[ability])}
              </div>
              <div className="mt-1 text-sm text-lore-muted tabular-nums">
                {sheet.abilityScores[ability]}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xs uppercase tracking-widest text-lore-muted">
              Saving Throws
            </h2>
            {onRegenerate && (
              <RegenButton
                onClick={() => onRegenerate(["saveProficiencies"])}
                pending={regenerating}
                title="Regenerate saving throws"
              />
            )}
          </div>
          <ul className="space-y-1.5">
            {sheet.savingThrows.map((save) => (
              <li
                key={save.ability}
                className="flex items-center justify-between rounded border border-lore-border bg-lore-surface px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      save.proficient ? "bg-lore-accent" : "bg-lore-border"
                    }`}
                    aria-hidden
                  />
                  {ABILITY_LABELS[save.ability]}
                </span>
                <span className="font-mono">{signed(save.modifier)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xs uppercase tracking-widest text-lore-muted">
              Skill Proficiencies
            </h2>
            {onRegenerate && (
              <RegenButton
                onClick={() => onRegenerate(["skillProficiencies"])}
                pending={regenerating}
                title="Regenerate skill proficiencies"
              />
            )}
          </div>
          {sheet.skillProficiencies.length === 0 ? (
            <p className="text-sm text-lore-muted">None.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {sheet.skillProficiencies.map((skill) => (
                <li
                  key={skill}
                  className="rounded-full border border-lore-border bg-lore-surface px-3 py-1 text-sm"
                >
                  {skill}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="mt-10 text-xs text-lore-muted">
        Stat block derived by{" "}
        <code className="text-lore-text">@app/engine</code> from the same
        character primitives as Character View.
      </p>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-[60px] rounded-lg border border-lore-border bg-lore-surface px-3 py-2">
      <div className="text-xs uppercase tracking-wide text-lore-muted">
        {label}
      </div>
      <div className="mt-0.5 font-display text-lg">{value}</div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/realms"
      className="text-sm text-lore-muted hover:text-lore-text"
    >
      ← Realms
    </Link>
  );
}
