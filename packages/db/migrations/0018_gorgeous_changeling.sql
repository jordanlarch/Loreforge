CREATE TABLE "pinned_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "pinned_memories_campaign_idx" ON "pinned_memories" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "pinned_memories_owner_idx" ON "pinned_memories" USING btree ("owner_id");