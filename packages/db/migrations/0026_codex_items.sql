CREATE TABLE "codex_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"description" text,
	"cost" text,
	"weight" text,
	"weight_unit" text,
	"source" text DEFAULT 'open5e' NOT NULL,
	"raw" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "codex_items_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "codex_items_name_idx" ON "codex_items" USING btree ("name");--> statement-breakpoint
CREATE INDEX "codex_items_category_idx" ON "codex_items" USING btree ("category");
