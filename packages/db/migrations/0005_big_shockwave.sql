CREATE TABLE "homebrew_spells" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"level" integer NOT NULL,
	"school" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"definition" jsonb NOT NULL,
	"source" text DEFAULT 'original' NOT NULL,
	"copied_from_slug" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "homebrew_spells_owner_idx" ON "homebrew_spells" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "homebrew_spells_level_idx" ON "homebrew_spells" USING btree ("level");