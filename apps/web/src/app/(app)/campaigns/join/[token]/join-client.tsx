"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { trpc } from "@/lib/trpc/client";

/** Redeem a campaign invite link (CAMP-14). */
export function JoinCampaignClient({ token }: { token: string }) {
  const router = useRouter();
  const invite = trpc.campaigns.getInvite.useQuery({ token });
  const redeem = trpc.campaigns.redeemInvite.useMutation({
    onSuccess: (data) => {
      router.push(`/campaigns/${data.campaignId}/play`);
    },
  });

  if (invite.isLoading) {
    return <p className="py-16 text-center text-lore-muted">Loading invite…</p>;
  }

  if (!invite.data) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-2xl">Invite not found</h1>
        <p className="mt-2 text-sm text-lore-muted">
          This link may have expired or already been used.
        </p>
        <Link href="/campaigns" className="mt-6 inline-block text-lore-accent underline">
          Back to campaigns
        </Link>
      </div>
    );
  }

  const used = Boolean(invite.data.redeemedByUserId);

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-2xl">Join campaign</h1>
      <p className="mt-2 text-lore-muted">
        You&apos;ve been invited to <strong>{invite.data.campaignName}</strong> as{" "}
        {invite.data.label}.
      </p>
      {used ? (
        <p className="mt-6 text-sm text-lore-muted">This invite has already been redeemed.</p>
      ) : (
        <button
          type="button"
          disabled={redeem.isPending}
          onClick={() => redeem.mutate({ token })}
          className="mt-6 w-full rounded border border-lore-accent bg-lore-accent-dim px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {redeem.isPending ? "Joining…" : "Accept invite & enter Live Play"}
        </button>
      )}
      {redeem.error ? (
        <p className="mt-3 text-sm text-red-400">{redeem.error.message}</p>
      ) : null}
    </div>
  );
}
