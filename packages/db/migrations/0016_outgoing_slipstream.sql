CREATE TABLE "rolling_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"covered_seq" integer DEFAULT 0 NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "rolling_summaries_campaign_unique" ON "rolling_summaries" USING btree ("campaign_id");