import { redirect } from "next/navigation";

import { CampaignWorkspace } from "./campaign-workspace";

/**
 * Campaign workspace route (#55). Opening a campaign lands here — the nine-tab
 * shell with the Overview tab populated — rather than dropping straight into
 * Live Play. The reserved id `sandbox` has no workspace, so it bounces to the
 * sandbox battle map.
 */
export default async function CampaignWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (id === "sandbox") redirect("/campaigns/sandbox/play");
  return <CampaignWorkspace campaignId={id} />;
}
