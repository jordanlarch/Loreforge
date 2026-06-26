ALTER TABLE "campaigns" ADD COLUMN "overworld_grid" jsonb DEFAULT '{"width":32,"height":20}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_world_entities" ADD COLUMN "overworld_map" jsonb DEFAULT '{}'::jsonb NOT NULL;
