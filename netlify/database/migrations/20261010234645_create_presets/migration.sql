CREATE TABLE "presets" (
	"id" serial PRIMARY KEY,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"settings" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "presets_user_name_idx" ON "presets" ("user_id","name");