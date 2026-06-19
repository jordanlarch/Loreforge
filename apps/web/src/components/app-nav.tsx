"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Home", exact: true },
  { href: "/characters", label: "Characters" },
  { href: "/realms", label: "Realms" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/codex", label: "Codex" },
  { href: "/smithy", label: "The Smithy" },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-lore-border bg-lore-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/" className="font-display text-lg font-semibold text-lore-accent">
          Loreforge
        </Link>
        <nav className="hidden flex-1 gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active =
              "exact" in item && item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-lore-surface text-lore-text"
                    : "text-lore-muted hover:text-lore-text"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
