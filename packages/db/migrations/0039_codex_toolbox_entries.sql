CREATE TABLE "codex_toolbox_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"topic" text NOT NULL,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'srd' NOT NULL,
	"definition" jsonb NOT NULL,
	"raw" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "codex_toolbox_entries_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "codex_toolbox_entries_name_idx" ON "codex_toolbox_entries" USING btree ("name");--> statement-breakpoint
CREATE INDEX "codex_toolbox_entries_topic_idx" ON "codex_toolbox_entries" USING btree ("topic");--> statement-breakpoint
CREATE INDEX "codex_toolbox_entries_sort_idx" ON "codex_toolbox_entries" USING btree ("sort_index");--> statement-breakpoint
CREATE TABLE "homebrew_toolbox_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"topic" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'original' NOT NULL,
	"copied_from_slug" text,
	"definition" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "homebrew_toolbox_entries_owner_idx" ON "homebrew_toolbox_entries" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "homebrew_toolbox_entries_topic_idx" ON "homebrew_toolbox_entries" USING btree ("topic");
