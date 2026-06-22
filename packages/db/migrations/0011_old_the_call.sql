CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"kind" text NOT NULL,
	"author" text NOT NULL,
	"mode" text,
	"text" text NOT NULL,
	"dice" jsonb,
	"mentions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "chat_messages_campaign_seq_unique" ON "chat_messages" USING btree ("campaign_id","seq");--> statement-breakpoint
CREATE INDEX "chat_messages_campaign_idx" ON "chat_messages" USING btree ("campaign_id");