CREATE TABLE IF NOT EXISTS "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"species" text DEFAULT '' NOT NULL,
	"background" text DEFAULT '' NOT NULL,
	"classes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ability_scores" jsonb NOT NULL,
	"max_hp" integer NOT NULL,
	"base_ac" integer NOT NULL,
	"speed" integer DEFAULT 30 NOT NULL,
	"save_proficiencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skill_proficiencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "characters_owner_idx" ON "characters" USING btree ("owner_id");
