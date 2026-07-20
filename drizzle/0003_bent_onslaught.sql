CREATE TABLE "ingest_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"upload_id" integer NOT NULL,
	"item_type" text NOT NULL,
	"suggested_subtopic_id" text,
	"suggested_subtopic_is_new" boolean DEFAULT false NOT NULL,
	"suggested_data" jsonb NOT NULL,
	"final_data" jsonb,
	"review_status" text DEFAULT 'pending' NOT NULL,
	"commit_error" text,
	"committed_table" text,
	"committed_id" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_uploads" (
	"id" serial PRIMARY KEY NOT NULL,
	"doc_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"storage_path" text NOT NULL,
	"original_filename" text NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"content_hash" text NOT NULL,
	"page_count" integer,
	"extracted_char_count" integer,
	"extracted_text" text,
	"text_truncated_for_ai" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"dup_of_upload_id" integer,
	"error_msg" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"extracted_at" timestamp,
	"structured_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "storage_upload_id" integer;--> statement-breakpoint
ALTER TABLE "ingest_items" ADD CONSTRAINT "ingest_items_upload_id_ingest_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."ingest_uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest_uploads" ADD CONSTRAINT "ingest_uploads_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_storage_upload_id_ingest_uploads_id_fk" FOREIGN KEY ("storage_upload_id") REFERENCES "public"."ingest_uploads"("id") ON DELETE no action ON UPDATE no action;