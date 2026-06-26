/** Campaign access role for prep vs play shells (CAMP-UX UX-6). */
export type CampaignAccessRole = "owner" | "player";

export function canAccessPrepShell(role: CampaignAccessRole | null): boolean {
  return role === "owner";
}

export function canAccessPlayShell(role: CampaignAccessRole | null): boolean {
  return role === "owner" || role === "player";
}

/** Owner uses the first PC roster row; seated players use their bound seat (CAMP-14). */
export function resolvePcCharacterId(
  role: CampaignAccessRole | null,
  seatedCharacterId: string | null | undefined,
  party: readonly { id: string; role: string }[] | undefined,
): string | undefined {
  if (role === "player") return seatedCharacterId ?? undefined;
  return party?.find((m) => m.role === "pc")?.id;
}
