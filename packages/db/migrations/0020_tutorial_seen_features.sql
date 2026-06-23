CREATE TABLE "tutorial_seen_features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"feature_id" text NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tutorial_seen_features_owner_feature_unique" ON "tutorial_seen_features" USING btree ("owner_id","feature_id");--> statement-breakpoint
CREATE INDEX "tutorial_seen_features_owner_idx" ON "tutorial_seen_features" USING btree ("owner_id");