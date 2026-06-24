CREATE TABLE "codex_monsters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"creature_type" text,
	"size" text,
	"challenge_rating" real,
	"armor_class" integer,
	"hit_points" integer,
	"alignment" text,
	"source" text DEFAULT 'open5e' NOT NULL,
	"raw" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "codex_monsters_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "codex_monsters_name_idx" ON "codex_monsters" USING btree ("name");--> statement-breakpoint
CREATE INDEX "codex_monsters_type_idx" ON "codex_monsters" USING btree ("creature_type");--> statement-breakpoint
CREATE INDEX "codex_monsters_cr_idx" ON "codex_monsters" USING btree ("challenge_rating");