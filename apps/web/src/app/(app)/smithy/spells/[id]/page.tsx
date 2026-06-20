import { SpellDetail } from "./spell-detail";

export default async function SpellDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SpellDetail id={id} />;
}
