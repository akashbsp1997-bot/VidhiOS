ALTER TABLE "ingest_uploads" ADD COLUMN "total_chunks" integer;--> statement-breakpoint
ALTER TABLE "ingest_uploads" ADD COLUMN "chunks_processed" integer DEFAULT 0 NOT NULL;