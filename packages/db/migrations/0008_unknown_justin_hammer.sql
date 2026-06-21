CREATE TABLE "campaign_characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"role" text DEFAULT 'pc' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "xp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "portrait_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "equipment" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "spells" jsonb DEFAULT '{"spells":[],"slots":{}}'::jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_characters_unique_idx" ON "campaign_characters" USING btree ("campaign_id","character_id");--> statement-breakpoint
CREATE INDEX "campaign_characters_campaign_idx" ON "campaign_characters" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaign_characters_character_idx" ON "campaign_characters" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "campaign_characters_owner_idx" ON "campaign_characters" USING btree ("owner_id");