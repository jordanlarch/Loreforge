import { SmithyBrowser } from "./smithy-browser";

export default function SmithyPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          The Smithy
        </h1>
        <p className="mt-2 text-lore-muted">
          Forge your own 5E items. Your homebrew library, scoped to you.
        </p>
      </header>

      <SmithyBrowser />
    </div>
  );
}
