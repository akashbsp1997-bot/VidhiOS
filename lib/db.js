// lib/db.js
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema.js";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill in your Supabase connection string — see README.md."
  );
}

// prepare:false is required when connecting through Supabase's pooled
// connection string (pgbouncer, transaction mode) — pgbouncer doesn't
// support prepared statements across pooled connections, and the postgres.js
// driver defaults to using them. If you connect via Supabase's *direct*
// (non-pooled) connection string instead, this flag is harmless either way.
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
