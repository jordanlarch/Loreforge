import { redirect } from "next/navigation";

import { legacyCodexSearchParamsToPath } from "@/lib/codex-routes";

/** Legacy `/codex?category=&slug=` and default entry → path routes (CODEX-3). */
export default async function CodexRootPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  redirect(legacyCodexSearchParamsToPath(params));
}
