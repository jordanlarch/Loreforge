CREATE TABLE "codex_rule_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'open5e' NOT NULL,
	"raw" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "codex_rule_chapters_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "codex_rule_chapters_name_idx" ON "codex_rule_chapters" USING btree ("name");--> statement-breakpoint
CREATE INDEX "codex_rule_chapters_sort_idx" ON "codex_rule_chapters" USING btree ("sort_index");--> statement-breakpoint
CREATE TABLE "codex_rule_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"chapter_slug" text NOT NULL,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'open5e' NOT NULL,
	"raw" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "codex_rule_sections_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "codex_rule_sections_name_idx" ON "codex_rule_sections" USING btree ("name");--> statement-breakpoint
CREATE INDEX "codex_rule_sections_chapter_idx" ON "codex_rule_sections" USING btree ("chapter_slug");--> statement-breakpoint
CREATE INDEX "codex_rule_sections_sort_idx" ON "codex_rule_sections" USING btree ("sort_index");
