import { RealmsBrowser } from "./realms-browser";

export default function RealmsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Realms
        </h1>
        <p className="mt-2 text-lore-muted">
          Your worldbuilding library — regions, settlements, factions, NPCs and
          more. Forge them by hand now; generators arrive in a later slice.
        </p>
      </header>

      <RealmsBrowser />
    </div>
  );
}
