import { ToolboxDetail } from "./toolbox-detail";

export default async function ToolboxDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ToolboxDetail id={id} />;
}
