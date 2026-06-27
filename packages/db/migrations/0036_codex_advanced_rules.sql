CREATE TABLE "codex_advanced_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"topic" text NOT NULL,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'open5e' NOT NULL,
	"raw" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "codex_advanced_rules_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "codex_advanced_rules_name_idx" ON "codex_advanced_rules" USING btree ("name");--> statement-breakpoint
CREATE INDEX "codex_advanced_rules_topic_idx" ON "codex_advanced_rules" USING btree ("topic");--> statement-breakpoint
CREATE INDEX "codex_advanced_rules_sort_idx" ON "codex_advanced_rules" USING btree ("sort_index");
