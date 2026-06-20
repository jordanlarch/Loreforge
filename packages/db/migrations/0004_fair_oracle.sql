CREATE TABLE "homebrew_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"rarity" text DEFAULT 'Common' NOT NULL,
	"properties" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"requires_attunement" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'original' NOT NULL,
	"copied_from_slug" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "homebrew_items_owner_idx" ON "homebrew_items" USING btree ("owner_id");