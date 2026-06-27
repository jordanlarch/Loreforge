/** Compact relative timestamp for library browse cards (SMITH-3). */
export function formatRelativeTime(date: Date | string): string {
  const then = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - then.getTime();
  if (Number.isNaN(diffMs)) return "";

  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;

  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;

  return then.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
