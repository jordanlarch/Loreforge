ALTER TABLE "homebrew_items" ADD COLUMN "definition" jsonb;--> statement-breakpoint
UPDATE "homebrew_items"
SET "definition" = jsonb_build_object(
  'id',
  lower(regexp_replace(trim("name"), '[^a-zA-Z0-9]+', '-', 'g')),
  'name',
  "name",
  'itemType',
  "type",
  'description',
  "description"
)
WHERE "definition" IS NULL;--> statement-breakpoint
ALTER TABLE "homebrew_items" ALTER COLUMN "definition" SET NOT NULL;
