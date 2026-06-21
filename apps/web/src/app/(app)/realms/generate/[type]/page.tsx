import Link from "next/link";
import { notFound } from "next/navigation";

import {
  REALM_ENTITY_TYPES,
  REALM_TYPE_LABEL,
  type RealmEntityType,
} from "@/lib/realms";

import { AdvancedGenerateForm } from "./advanced-generate-form";

export default async function GenerateEntityPage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  if (!REALM_ENTITY_TYPES.includes(type as RealmEntityType)) {
    notFound();
  }
  const entityType = type as RealmEntityType;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link
        href="/realms"
        className="text-sm text-lore-muted hover:text-lore-text"
      >
        ← Realms
      </Link>
      <header className="mt-3 border-b border-lore-border pb-5">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          <span className="text-lore-accent">⚒</span> Forge a{" "}
          {REALM_TYPE_LABEL[entityType]}
        </h1>
        <p className="mt-2 text-lore-muted">
          Describe what you want, optionally pin a few details, and the AI fills
          in the rest. You can edit everything afterward.
        </p>
      </header>
      <AdvancedGenerateForm type={entityType} />
    </div>
  );
}
