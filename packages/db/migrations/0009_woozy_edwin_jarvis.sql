CREATE TABLE "campaign_world_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"discovered" boolean DEFAULT false NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_world_entities_unique_idx" ON "campaign_world_entities" USING btree ("campaign_id","entity_id");--> statement-breakpoint
CREATE INDEX "campaign_world_entities_campaign_idx" ON "campaign_world_entities" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaign_world_entities_entity_idx" ON "campaign_world_entities" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "campaign_world_entities_owner_idx" ON "campaign_world_entities" USING btree ("owner_id");