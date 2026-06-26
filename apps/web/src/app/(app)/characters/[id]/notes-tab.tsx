"use client";

import { SheetSection, StubBanner } from "@/components/character-sheet/sheet-ui";
import {
  DEFAULT_NOTE_CATEGORIES,
  type CharacterSheetMeta,
  type NoteCategory,
  type NoteEntry,
} from "@/lib/character-sheet-storage";

export function NotesTab({
  sessionNotes,
  meta,
  onPatchSessionNotes,
  onPatchMeta,
}: {
  sessionNotes: string;
  meta: CharacterSheetMeta;
  onPatchSessionNotes: (notes: string) => void;
  onPatchMeta: (patch: Partial<CharacterSheetMeta>) => void;
}) {
  const categories =
    meta.noteCategories?.length ? meta.noteCategories : DEFAULT_NOTE_CATEGORIES;

  function updateCategories(next: NoteCategory[]) {
    onPatchMeta({ noteCategories: next });
  }

  function addEntry(categoryId: string) {
    updateCategories(
      categories.map((c) =>
        c.id === categoryId
          ? {
              ...c,
              entries: [
                ...c.entries,
                { id: `n-${Date.now()}`, name: "New entry", description: "" },
              ],
            }
          : c,
      ),
    );
  }

  function patchEntry(
    categoryId: string,
    entryId: string,
    patch: Partial<NoteEntry>,
  ) {
    updateCategories(
      categories.map((c) =>
        c.id === categoryId
          ? {
              ...c,
              entries: c.entries.map((e) =>
                e.id === entryId ? { ...e, ...patch } : e,
              ),
            }
          : c,
      ),
    );
  }

  function removeEntry(categoryId: string, entryId: string) {
    updateCategories(
      categories.map((c) =>
        c.id === categoryId
          ? { ...c, entries: c.entries.filter((e) => e.id !== entryId) }
          : c,
      ),
    );
  }

  function addCategory() {
    const id = `cat-${Date.now()}`;
    updateCategories([...categories, { id, name: "New category", entries: [] }]);
  }

  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <SheetSection
          key={cat.id}
          title={cat.name.toUpperCase()}
          onAdd={() => addEntry(cat.id)}
        >
          {cat.entries.length === 0 ? (
            <p className="text-sm text-lore-muted">
              You currently have no {cat.name.toLowerCase()}.
            </p>
          ) : (
            <ul className="space-y-3">
              {cat.entries.map((entry) => (
                <li key={entry.id} className="rounded border border-lore-border p-3">
                  <input
                    defaultValue={entry.name}
                    onBlur={(e) =>
                      patchEntry(cat.id, entry.id, { name: e.target.value.trim() })
                    }
                    className="w-full bg-transparent font-medium outline-none"
                  />
                  <textarea
                    defaultValue={entry.description}
                    rows={2}
                    onBlur={(e) =>
                      patchEntry(cat.id, entry.id, {
                        description: e.target.value.trim(),
                      })
                    }
                    className="mt-2 w-full rounded border border-lore-border bg-lore-bg px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeEntry(cat.id, entry.id)}
                    className="mt-2 text-xs text-red-300"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SheetSection>
      ))}

      <button
        type="button"
        onClick={addCategory}
        className="text-sm text-lore-accent hover:underline"
      >
        + Add New Category
      </button>

      <SheetSection title="Session notes">
        <textarea
          defaultValue={sessionNotes}
          rows={6}
          onBlur={(e) => onPatchSessionNotes(e.target.value.trim())}
          placeholder="Freeform campaign notes…"
          className="w-full rounded border border-lore-border bg-lore-bg px-3 py-2 text-sm"
        />
      </SheetSection>

      <StubBanner>
        Campaign-specific vs private note toggles ship with multiplayer party
        permissions.
      </StubBanner>
    </div>
  );
}
