import { AppNav } from "@/components/app-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import { enforceTutorialGate } from "@/server/tutorial-gate-enforce";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await enforceTutorialGate();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <AppNav />
      <div className="mx-auto flex max-w-6xl justify-end px-4 py-2">
        {user?.email && (
          <span className="mr-4 text-sm text-lore-muted">{user.email}</span>
        )}
        <SignOutButton />
      </div>
      <main>{children}</main>
    </>
  );
}
