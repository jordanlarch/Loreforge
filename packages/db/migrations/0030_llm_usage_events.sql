CREATE TABLE "llm_usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"campaign_id" uuid,
	"surface" text NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6),
	"status" text DEFAULT 'success' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "llm_usage_events_owner_idx" ON "llm_usage_events" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "llm_usage_events_campaign_idx" ON "llm_usage_events" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "llm_usage_events_created_idx" ON "llm_usage_events" USING btree ("created_at");
