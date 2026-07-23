CREATE TABLE "current_affairs_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"published_date" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"source_url" text NOT NULL,
	"source_name" text,
	"related_subtopic_ids" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "current_affairs_items_source_url_unique" UNIQUE("source_url")
);
