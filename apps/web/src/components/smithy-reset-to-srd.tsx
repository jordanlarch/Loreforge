"use client";

import { useState } from "react";

import { trpc } from "@/lib/trpc/client";

import { SmithyToast } from "./smithy-toast";

/** Reset a Codex-copied homebrew row to current SRD source (SMITH-6). */
export function SmithyResetToSrdButton({
  kind,
  id,
  onReset,
}: {
  kind: "spell" | "item";
  id: string;
  onReset?: () => void;
}) {
  const utils = trpc.useUtils();
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<"success" | "error">("success");

  const reset = trpc.smithy.resetFromCodex.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.smithy.listLibrary.invalidate(),
        kind === "spell"
          ? utils.smithy.getSpell.invalidate({ id })
          : utils.smithy.get.invalidate({ id }),
        kind === "spell"
          ? utils.smithy.listSpells.invalidate()
          : utils.smithy.list.invalidate(),
      ]);
      setConfirming(false);
      setToast("Reset to SRD defaults.");
      setToastTone("success");
      onReset?.();
    },
    onError: (err) => {
      setToast(err.message);
      setToastTone("error");
    },
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {confirming ? (
        <>
          <button
            type="button"
            disabled={reset.isPending}
            onClick={() => reset.mutate({ kind, id })}
            className="rounded border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-sm text-amber-200 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
          >
            {reset.isPending ? "Resetting…" : "Confirm reset"}
          </button>
          <button
            type="button"
            disabled={reset.isPending}
            onClick={() => setConfirming(false)}
            className="text-sm text-lore-muted hover:text-lore-text"
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded border border-lore-border px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent"
        >
          Reset to SRD
        </button>
      )}
      {toast ? (
        <SmithyToast
          message={toast}
          tone={toastTone}
          onDismiss={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}
