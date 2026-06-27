"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { CodexCategory } from "@/lib/codex-categories";
import { trpc } from "@/lib/trpc/client";

import { SmithyToast } from "./smithy-toast";

const BTN =
  "rounded border border-lore-accent bg-lore-accent-dim px-3 py-1.5 text-sm text-lore-text transition-colors hover:border-lore-accent disabled:opacity-50";

export function CodexCopyToSmithyButton({
  category,
  slug,
  onCopied,
}: {
  category: CodexCategory;
  slug: string;
  /** Called after a successful copy (e.g. close detail modal). */
  onCopied?: () => void;
}) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [toast, setToast] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<"success" | "error">("success");

  const copy = trpc.smithy.copyFromCodex.useMutation({
    onSuccess: async (result) => {
      await Promise.all([
        utils.smithy.listLibrary.invalidate(),
        utils.smithy.listSpells.invalidate(),
        utils.smithy.list.invalidate(),
      ]);
      setToast("Copied to The Smithy — ready to forge!");
      setToastTone("success");
      onCopied?.();
      window.setTimeout(() => {
        if (result.kind === "spell") {
          router.push(`/smithy/spells/${result.id}`);
        } else {
          router.push(`/smithy/${result.id}`);
        }
      }, 600);
    },
    onError: (err) => {
      setToast(err.message);
      setToastTone("error");
    },
  });

  return (
    <>
      <button
        type="button"
        onClick={() => copy.mutate({ category, slug })}
        disabled={copy.isPending}
        className={BTN}
      >
        {copy.isPending ? "Copying…" : "Copy to The Smithy"}
      </button>
      {toast ? (
        <SmithyToast
          message={toast}
          tone={toastTone}
          onDismiss={() => setToast(null)}
        />
      ) : null}
    </>
  );
}
