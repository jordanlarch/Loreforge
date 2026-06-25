ALTER TABLE "plot_hooks" ADD COLUMN "data" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "plot_hooks" ADD COLUMN "source_template_id" uuid;
