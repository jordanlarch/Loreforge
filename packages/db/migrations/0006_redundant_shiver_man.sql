CREATE TABLE "realm_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"is_stub" boolean DEFAULT false NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "realm_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"from_id" uuid NOT NULL,
	"to_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "realm_entities_owner_idx" ON "realm_entities" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "realm_entities_owner_type_idx" ON "realm_entities" USING btree ("owner_id","type");--> statement-breakpoint
CREATE INDEX "realm_relationships_owner_idx" ON "realm_relationships" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "realm_relationships_from_idx" ON "realm_relationships" USING btree ("from_id");--> statement-breakpoint
CREATE INDEX "realm_relationships_to_idx" ON "realm_relationships" USING btree ("to_id");