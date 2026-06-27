import { SmithyBrowser } from "./smithy-browser";
import { SmithyRightPane } from "@/components/smithy-right-pane";

export default function SmithyPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-8">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          The Smithy
        </h1>
        <p className="mt-2 text-lore-muted">
          Forge your own 5E content. Copy from the Codex, customize freely — your
          homebrew library, scoped to you.
        </p>
      </header>

      <div className="grid gap-8 xl:grid-cols-[1fr_240px]">
        <SmithyBrowser />
        <SmithyRightPane />
      </div>
    </div>
  );
}
