"use client";

import { useMemo, useState } from "react";

import {
  createId,
  defaultTracerTriggers,
  normalizeEntityQuests,
  type QuestStep,
  type QuestTemplate,
} from "@app/engine";

import { trpc } from "@/lib/trpc/client";
import type { RealmEntityType } from "@/lib/realms";

const QUEST_ENTITY_TYPES = new Set<RealmEntityType>([
  "region",
  "settlement",
  "tavern",
  "shop",
  "building",
  "dungeon",
  "faction",
]);

type Props = {
  entityId: string;
  entityType: RealmEntityType;
  name: string;
  summary: string;
  isStub: boolean;
  data: Record<string, unknown>;
};

/** Realms quest template CRUD (Phase B). */
export function QuestsSection({
  entityId,
  entityType,
  name,
  summary,
  isStub,
  data,
}: Props) {
  const utils = trpc.useUtils();
  const update = trpc.realms.update.useMutation({
    onSuccess: async () => {
      await utils.realms.get.invalidate({ id: entityId });
    },
  });

  const quests = useMemo(
    () => normalizeEntityQuests(data, entityId),
    [data, entityId],
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!QUEST_ENTITY_TYPES.has(entityType)) return null;

  async function saveQuests(nextQuests: QuestTemplate[]) {
    await update.mutateAsync({
      id: entityId,
      type: entityType,
      name,
      summary,
      isStub,
      data: {
        ...data,
        quests: nextQuests,
        hooks: nextQuests.map((q) => q.teaseText ?? q.title),
      },
    });
    setEditingId(null);
  }

  function addQuest() {
    const template: QuestTemplate = {
      id: createId(),
      title: "New quest",
      teaseText: "",
      offerText: "",
      description: "",
      gmInstructions: "",
      triggers: defaultTracerTriggers(entityId),
      steps: [
        {
          id: createId(),
          title: "First step",
          gmInstructions: "",
        },
      ],
      source: "manual",
    };
    void saveQuests([...quests, template]);
    setEditingId(template.id);
  }

  function updateQuest(template: QuestTemplate) {
    void saveQuests(
      quests.map((q) => (q.id === template.id ? template : q)),
    );
  }

  function deleteQuest(id: string) {
    void saveQuests(quests.filter((q) => q.id !== id));
  }

  function duplicateQuest(template: QuestTemplate) {
    const copy: QuestTemplate = {
      ...template,
      id: createId(),
      title: `${template.title} (copy)`,
      steps: (template.steps ?? []).map((s) => ({
        ...s,
        id: createId(),
      })),
      source: "manual",
    };
    void saveQuests([...quests, copy]);
  }

  return (
    <section className="mt-8 rounded-lg border border-lore-border bg-lore-surface p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg">Quests</h2>
        <button
          type="button"
          onClick={addQuest}
          disabled={update.isPending}
          className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm disabled:opacity-40"
        >
          + Add quest
        </button>
      </div>
      <p className="mb-4 text-sm text-lore-muted">
        Structured quest templates embedded on this entity. Accept them into a
        campaign from the Quests workspace tab.
      </p>

      {quests.length === 0 ? (
        <p className="text-sm text-lore-muted">
          No quests yet — add one or keep legacy plot-hook strings in Lore &
          Hooks below.
        </p>
      ) : (
        <ul className="space-y-4">
          {quests.map((quest) => (
            <li
              key={quest.id}
              className="rounded border border-lore-border bg-lore-bg/40 p-4"
            >
              {editingId === quest.id ? (
                <QuestEditor
                  quest={quest}
                  busy={update.isPending}
                  onSave={(q) => updateQuest(q)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-lore-text">{quest.title}</h3>
                    {(quest.teaseText || quest.description) && (
                      <p className="mt-1 text-sm text-lore-muted line-clamp-2">
                        {quest.teaseText ?? quest.description}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-lore-muted">
                      {(quest.steps ?? []).length} step
                      {(quest.steps ?? []).length === 1 ? "" : "s"}
                      {(quest.tags ?? []).length > 0 &&
                        ` · ${(quest.tags ?? []).join(", ")}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => setEditingId(quest.id)}
                      className="text-lore-muted hover:text-lore-text"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => duplicateQuest(quest)}
                      className="text-lore-muted hover:text-lore-text"
                    >
                      Duplicate
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteQuest(quest.id)}
                      className="text-lore-muted hover:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function QuestEditor({
  quest,
  busy,
  onSave,
  onCancel,
}: {
  quest: QuestTemplate;
  busy: boolean;
  onSave: (quest: QuestTemplate) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(quest);

  function patch(partial: Partial<QuestTemplate>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  function patchStep(index: number, partial: Partial<QuestStep>) {
    const steps = [...(draft.steps ?? [])];
    steps[index] = { ...steps[index]!, ...partial };
    patch({ steps });
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
    >
      <label className="block text-xs uppercase tracking-widest text-lore-muted">
        Title
        <input
          value={draft.title}
          onChange={(e) => patch({ title: e.target.value })}
          className="mt-1 w-full rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm"
          required
        />
      </label>
      <label className="block text-xs uppercase tracking-widest text-lore-muted">
        Tease (session / travel)
        <textarea
          value={draft.teaseText ?? ""}
          onChange={(e) => patch({ teaseText: e.target.value })}
          rows={2}
          className="mt-1 w-full rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-xs uppercase tracking-widest text-lore-muted">
        Offer (NPC pitch)
        <textarea
          value={draft.offerText ?? ""}
          onChange={(e) => patch({ offerText: e.target.value })}
          rows={2}
          className="mt-1 w-full rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-xs uppercase tracking-widest text-lore-muted">
        Description
        <textarea
          value={draft.description ?? ""}
          onChange={(e) => patch({ description: e.target.value })}
          rows={2}
          className="mt-1 w-full rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-xs uppercase tracking-widest text-lore-muted">
        GM instructions (canon)
        <textarea
          value={draft.gmInstructions ?? ""}
          onChange={(e) => patch({ gmInstructions: e.target.value })}
          rows={3}
          className="mt-1 w-full rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm"
        />
      </label>
      <div>
        <p className="text-xs uppercase tracking-widest text-lore-muted">Steps</p>
        {(draft.steps ?? []).map((step, index) => (
          <div
            key={step.id}
            className="mt-2 rounded border border-lore-border/60 p-3"
          >
            <input
              value={step.title}
              onChange={(e) => patchStep(index, { title: e.target.value })}
              placeholder="Step title"
              className="mb-2 w-full rounded border border-lore-border bg-lore-bg px-2 py-1 text-sm"
            />
            <textarea
              value={step.gmInstructions ?? ""}
              onChange={(e) =>
                patchStep(index, { gmInstructions: e.target.value })
              }
              placeholder="GM instructions for this step"
              rows={2}
              className="w-full rounded border border-lore-border bg-lore-bg px-2 py-1 text-sm"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            patch({
              steps: [
                ...(draft.steps ?? []),
                { id: createId(), title: "New step", gmInstructions: "" },
              ],
            })
          }
          className="mt-2 text-sm text-lore-accent hover:underline"
        >
          + Add step
        </button>
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={busy || draft.title.trim().length === 0}
          className="rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save quest"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-lore-border px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
