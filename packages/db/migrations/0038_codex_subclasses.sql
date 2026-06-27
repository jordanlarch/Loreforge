-- CODEX-SUBCLASSES: curated SRD subclass reference rows
CREATE TABLE IF NOT EXISTS "codex_subclasses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "class_slug" text NOT NULL,
  "class_name" text NOT NULL,
  "pick_level" integer NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "features" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "source" text DEFAULT 'srd' NOT NULL,
  "raw" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "codex_subclasses_slug_unique" UNIQUE("slug")
);

CREATE INDEX IF NOT EXISTS "codex_subclasses_name_idx" ON "codex_subclasses" ("name");
CREATE INDEX IF NOT EXISTS "codex_subclasses_class_idx" ON "codex_subclasses" ("class_slug");
