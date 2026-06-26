/** Campaign access role for prep vs play shells (CAMP-UX UX-6). */
export type CampaignAccessRole = "owner" | "player";

export function canAccessPrepShell(role: CampaignAccessRole | null): boolean {
  return role === "owner";
}

export function canAccessPlayShell(role: CampaignAccessRole | null): boolean {
  return role === "owner" || role === "player";
}
