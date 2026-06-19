export function PlaceholderPage({
  title,
  phase,
}: {
  title: string;
  phase: string;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <h1 className="font-display text-3xl font-semibold">{title}</h1>
      <p className="mt-4 text-lore-muted">Coming in {phase}.</p>
    </div>
  );
}
