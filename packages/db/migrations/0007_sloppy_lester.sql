CREATE TABLE "generation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"entity_id" uuid,
	"entity_type" text NOT NULL,
	"mode" text NOT NULL,
	"status" text NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6),
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "generation_events_owner_idx" ON "generation_events" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "generation_events_created_idx" ON "generation_events" USING btree ("created_at");