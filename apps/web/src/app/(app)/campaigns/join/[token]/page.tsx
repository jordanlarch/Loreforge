import { JoinCampaignClient } from "./join-client";

export default async function JoinCampaignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <JoinCampaignClient token={token} />;
}
