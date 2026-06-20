import { ItemDetail } from "./item-detail";

export default async function HomebrewItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ItemDetail id={id} />;
}
