ALTER TABLE "campaign_characters" ADD COLUMN "player_user_id" uuid;--> statement-breakpoint
CREATE TABLE "campaign_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"token" text NOT NULL,
	"character_id" uuid,
	"label" text DEFAULT 'Player' NOT NULL,
	"redeemed_by_user_id" uuid,
	"redeemed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_invites_token_unique" ON "campaign_invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "campaign_invites_campaign_idx" ON "campaign_invites" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaign_invites_owner_idx" ON "campaign_invites" USING btree ("owner_id");--> statement-breakpoint
CREATE TABLE "campaign_reputation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"subject_key" text NOT NULL,
	"subject_name" text NOT NULL,
	"standing" text DEFAULT 'neutral' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_reputation_unique_idx" ON "campaign_reputation" USING btree ("campaign_id","subject_key");--> statement-breakpoint
CREATE INDEX "campaign_reputation_campaign_idx" ON "campaign_reputation" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaign_reputation_owner_idx" ON "campaign_reputation" USING btree ("owner_id");
