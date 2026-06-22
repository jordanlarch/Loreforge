CREATE TABLE "encounters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"foes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_entity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "active_encounter_id" uuid;--> statement-breakpoint
CREATE INDEX "encounters_campaign_idx" ON "encounters" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "encounters_owner_idx" ON "encounters" USING btree ("owner_id");