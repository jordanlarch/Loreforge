import { CampaignPlayNotice, SandboxPlaySurface } from "./play-surface";

/**
 * Live Play route (#16). The reserved id `sandbox` renders the interactive
 * fixture battle map; real campaign ids show a notice until per-campaign live
 * play + Yjs sync (#14) lands.
 */
export default async function PlayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (id === "sandbox") return <SandboxPlaySurface />;
  return <CampaignPlayNotice campaignId={id} />;
}
