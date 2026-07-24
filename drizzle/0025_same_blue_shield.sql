CREATE TABLE "monthly_digests" (
	"month" text PRIMARY KEY NOT NULL,
	"overview" text NOT NULL,
	"themes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"item_count" integer NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
