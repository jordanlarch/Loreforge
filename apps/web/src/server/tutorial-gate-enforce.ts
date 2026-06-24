import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { getDb, tutorialProgress } from "@app/db";
import { parseServerEnv } from "@app/config";

import { createClient } from "@/lib/supabase/server";
import {
  shouldRedirectToTutorialSplash,
  tutorialProgressState,
} from "@/lib/tutorial-gate";

/**
 * Server-side tutorial launch gate (TUT-1, #177). Called from the authenticated
 * app layout so first-run users land on the splash before any other surface.
 */
export async function enforceTutorialGate(): Promise<void> {
  const gate = parseServerEnv().TUTORIAL_GATE;
  if (gate === "off") return;

  const pathname = (await headers()).get("x-pathname") ?? "/";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const [row] = await getDb()
    .select({ status: tutorialProgress.status })
    .from(tutorialProgress)
    .where(eq(tutorialProgress.ownerId, user.id))
    .limit(1);

  const progress = tutorialProgressState(row);
  if (shouldRedirectToTutorialSplash(gate, progress, pathname)) {
    redirect("/tutorial");
  }
}
