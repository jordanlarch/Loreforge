ALTER TABLE "campaigns" ADD COLUMN "gm_persona" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "play_mode" text DEFAULT 'async' NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "art_style" text DEFAULT '' NOT NULL;