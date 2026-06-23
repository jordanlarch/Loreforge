CREATE TABLE "tutorial_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"current_scene_id" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "is_tutorial" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tutorial_progress_owner_unique" ON "tutorial_progress" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "tutorial_progress_campaign_idx" ON "tutorial_progress" USING btree ("campaign_id");