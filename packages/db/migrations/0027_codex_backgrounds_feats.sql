CREATE TABLE "codex_backgrounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source" text DEFAULT 'open5e' NOT NULL,
	"raw" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "codex_backgrounds_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "codex_backgrounds_name_idx" ON "codex_backgrounds" USING btree ("name");--> statement-breakpoint
CREATE TABLE "codex_feats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"prerequisite" text,
	"feat_type" text,
	"source" text DEFAULT 'open5e' NOT NULL,
	"raw" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "codex_feats_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX "codex_feats_name_idx" ON "codex_feats" USING btree ("name");--> statement-breakpoint
CREATE INDEX "codex_feats_type_idx" ON "codex_feats" USING btree ("feat_type");
