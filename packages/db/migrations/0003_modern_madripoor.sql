CREATE TABLE "codex_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"hit_die" integer NOT NULL,
	"saving_throws" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skill_choice" jsonb NOT NULL,
	"source" text DEFAULT 'srd' NOT NULL,
	"raw" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "codex_classes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "codex_species" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"ability_bonuses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"speed" integer DEFAULT 30 NOT NULL,
	"size" text DEFAULT 'Medium' NOT NULL,
	"traits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text DEFAULT 'srd' NOT NULL,
	"raw" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "codex_species_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "codex_classes_name_idx" ON "codex_classes" USING btree ("name");--> statement-breakpoint
CREATE INDEX "codex_species_name_idx" ON "codex_species" USING btree ("name");