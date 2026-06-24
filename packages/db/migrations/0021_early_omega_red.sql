CREATE TABLE "tutorial_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"achievement_id" text NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tutorial_achievements_owner_achievement_unique" ON "tutorial_achievements" USING btree ("owner_id","achievement_id");--> statement-breakpoint
CREATE INDEX "tutorial_achievements_owner_idx" ON "tutorial_achievements" USING btree ("owner_id");