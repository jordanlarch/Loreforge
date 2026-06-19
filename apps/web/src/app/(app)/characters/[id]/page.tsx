import { CharacterSheetView } from "./character-sheet";

export default async function CharacterSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CharacterSheetView id={id} />;
}
