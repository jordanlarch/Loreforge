"use client";

import { useEffect } from "react";

/** Brief success/error notice after Smithy copy actions (SMITH-6). */
export function SmithyToast({
  message,
  tone = "success",
  onDismiss,
  durationMs = 2800,
}: {
  message: string;
  tone?: "success" | "error";
  onDismiss?: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!onDismiss) return;
    const id = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(id);
  }, [message, onDismiss, durationMs]);

  return (
    <p
      className={`rounded border px-3 py-2 text-sm ${
        tone === "error"
          ? "border-red-500/40 bg-red-500/10 text-red-300"
          : "border-lore-accent bg-lore-accent-dim text-lore-text"
      }`}
      role="status"
    >
      {message}
    </p>
  );
}
