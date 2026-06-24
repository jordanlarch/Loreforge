ALTER TABLE "characters" ADD COLUMN "library_visibility" text DEFAULT 'library' NOT NULL;
--> statement-breakpoint
UPDATE "characters" c
SET "library_visibility" = 'campaign_only'
WHERE EXISTS (
  SELECT 1
  FROM "campaign_characters" cc
  INNER JOIN "campaigns" camp ON camp.id = cc.campaign_id
  WHERE cc.character_id = c.id AND camp.is_tutorial = true
);
