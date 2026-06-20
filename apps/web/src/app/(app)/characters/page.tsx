import { CharactersBrowser } from "./characters-browser";

export default function CharactersPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Characters
        </h1>
        <p className="mt-2 text-lore-muted">
          Persistent character sheets, built with the Creation Wizard and
          derived by <code className="text-lore-text">@app/engine</code>.
        </p>
      </header>

      <CharactersBrowser />
    </div>
  );
}
