CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"campaign_id" uuid,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"chunk_index" integer DEFAULT 0 NOT NULL,
	"chunk_text" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"content_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "embeddings_hnsw_idx" ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "embeddings_owner_idx" ON "embeddings" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "embeddings_campaign_idx" ON "embeddings" USING btree ("campaign_id");--> statement-breakpoint
CREATE UNIQUE INDEX "embeddings_source_chunk_unique" ON "embeddings" USING btree ("source_type","source_id","chunk_index");