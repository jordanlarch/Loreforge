import { CodexBrowser } from "./codex-browser";

const CATEGORIES = [
  "Spells",
  "Rules",
  "Species",
  "Backgrounds",
  "Classes",
  "Animals",
  "Monsters",
  "Items",
  "Feats",
] as const;

export default function CodexPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-lore-accent">
          Official 5E SRD 5.2 Reference
        </p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
          The Codex
        </h1>
        <div className="mt-4 flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <span
              key={cat}
              className={`rounded-full px-3 py-1 text-xs ${
                cat === "Spells"
                  ? "bg-lore-accent-dim text-lore-text"
                  : "border border-lore-border text-lore-muted"
              }`}
            >
              {cat}
              {cat !== "Spells" && (
                <span className="ml-1 text-[10px] opacity-70">soon</span>
              )}
            </span>
          ))}
        </div>
      </header>

      <CodexBrowser />
    </div>
  );
}
