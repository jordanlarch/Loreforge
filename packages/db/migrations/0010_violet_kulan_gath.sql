CREATE TABLE "plot_hooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'suggested' NOT NULL,
	"source_entity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "plot_hooks_campaign_idx" ON "plot_hooks" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "plot_hooks_owner_idx" ON "plot_hooks" USING btree ("owner_id");