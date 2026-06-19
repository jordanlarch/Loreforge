CREATE TABLE IF NOT EXISTS "engine_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"session_id" uuid,
	"sequence" bigint NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engine_events_campaign_seq_idx" ON "engine_events" USING btree ("campaign_id","sequence");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engine_events_campaign_idx" ON "engine_events" USING btree ("campaign_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engine_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"snapshot_at_event_id" uuid NOT NULL,
	"state" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engine_snapshots_campaign_idx" ON "engine_snapshots" USING btree ("campaign_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engine_command_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"command_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"accepted" boolean DEFAULT false NOT NULL,
	"rejection_reason" text,
	"events_produced" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engine_command_log_campaign_idx" ON "engine_command_log" USING btree ("campaign_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engine_seeds" (
	"campaign_id" uuid NOT NULL,
	"scope" text NOT NULL,
	"seed" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "engine_seeds_campaign_id_scope_pk" PRIMARY KEY("campaign_id","scope")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engine_seeds_campaign_scope_idx" ON "engine_seeds" USING btree ("campaign_id","scope");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "codex_spells" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"level" text,
	"school" text,
	"source" text DEFAULT 'open5e' NOT NULL,
	"raw" jsonb NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "codex_spells_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "codex_spells_name_idx" ON "codex_spells" USING btree ("name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "codex_spells_level_idx" ON "codex_spells" USING btree ("level");
