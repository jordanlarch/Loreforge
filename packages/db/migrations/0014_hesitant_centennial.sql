CREATE TABLE "campaign_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"shared" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "campaign_notes_campaign_idx" ON "campaign_notes" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaign_notes_owner_idx" ON "campaign_notes" USING btree ("owner_id");