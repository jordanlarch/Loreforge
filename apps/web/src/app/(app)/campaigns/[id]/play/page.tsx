import { CampaignPlaySurface, SandboxPlaySurface } from "./play-surface";

/**
 * Live Play route. The reserved id `sandbox` renders the interactive fixture
 * battle map (#16); a real campaign id renders persisted, owner-scoped live
 * play backed by the Yjs sync server (#14 scope B).
 */
export default async function PlayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (id === "sandbox") return <SandboxPlaySurface />;
  return <CampaignPlaySurface campaignId={id} />;
}
