"use client";

import { useRouter } from "next/navigation";

import type { CodexCategory } from "@/lib/codex-categories";
import { trpc } from "@/lib/trpc/client";

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

  const copy = trpc.smithy.copyFromCodex.useMutation({
    onSuccess: async (result) => {
      if (result.kind === "spell") {
        await utils.smithy.listSpells.invalidate();
        onCopied?.();
        router.push(`/smithy/spells/${result.id}`);
        return;
      }
      await utils.smithy.list.invalidate();
      onCopied?.();
      router.push(`/smithy/${result.id}`);
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
      {copy.error ? (
        <p className="w-full text-sm text-red-400">{copy.error.message}</p>
      ) : null}
    </>
  );
}
