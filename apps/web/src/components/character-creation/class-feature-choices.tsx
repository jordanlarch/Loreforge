"use client";

/** SRD 5.2 Ranger — Favored Enemy (Hunter's Mark) and Deft Explorer are automatic at L1/L2. */
export function RangerFeatureChoices() {
  return (
    <div className="mt-4 rounded-lg border border-lore-border bg-lore-surface px-4 py-3 text-sm">
      <h3 className="text-xs uppercase tracking-wide text-lore-muted">
        Ranger features
      </h3>
      <ul className="mt-2 space-y-2 text-xs text-lore-muted">
        <li>
          <span className="font-medium text-lore-text">Favored Enemy (L1)</span>
          {" — "}
          You always have Hunter&apos;s Mark prepared and can cast it without
          expending a spell slot a number of times equal to your Wisdom modifier
          per Long Rest.
        </li>
        <li>
          <span className="font-medium text-lore-text">Deft Explorer (L2)</span>
          {" — "}
          You gain Expertise in one skill and learn two languages of your choice.
        </li>
      </ul>
    </div>
  );
}

/** No mandatory Ranger picks in SRD 5.2 at creation. */
export function rangerFeatureChoicesComplete(
  _choices: Record<string, string>,
): boolean {
  return true;
}
