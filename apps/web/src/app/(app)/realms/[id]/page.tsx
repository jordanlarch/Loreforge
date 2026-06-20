import { RealmEntityDetail } from "./realm-detail";

export default async function RealmEntityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RealmEntityDetail id={id} />;
}
