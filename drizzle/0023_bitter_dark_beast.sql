-- USING clauses added by hand: Postgres has no implicit/assignment cast from
-- text to bytea, so the bare ALTER COLUMN ... SET DATA TYPE bytea drizzle-kit
-- generated here would fail against a real database. Casting via ::bytea
-- reinterprets each existing row's plain-UTF8 text as raw (uncompressed)
-- bytes -- exactly what lib/db/compressedText.js's fromDriver expects for
-- data written before this migration (it sniffs the gzip magic bytes and
-- falls back to treating non-gzip bytes as plain UTF-8), so every
-- already-cached row keeps reading correctly with no separate backfill
-- step. Only rows written AFTER this migration get gzip-compressed on
-- write; existing rows compress the next time they're re-fetched/re-cached.
ALTER TABLE "ingest_uploads" ALTER COLUMN "extracted_text" SET DATA TYPE bytea USING "extracted_text"::bytea;--> statement-breakpoint
ALTER TABLE "sources" ALTER COLUMN "extracted_text" SET DATA TYPE bytea USING "extracted_text"::bytea;