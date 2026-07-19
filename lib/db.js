// lib/db.js
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema.js";

// Connection is created lazily, on first query, rather than at module
// import time. Next.js's build step ("Collecting page data") imports every
// route module to inspect its exports, which would otherwise require
// DATABASE_URL to be present at BUILD time and fail `next build` outright
// if it isn't — even though the actual app only needs it at request time.
let _db = null;

function getDb() {
  if (_db) return _db;

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
  _db = drizzle(client, { schema });
  return _db;
}

// Proxy so existing call sites (`db.select()`, `db.insert()`, ...) keep
// working unchanged; methods are bound to the real instance so `this`
// inside drizzle's internals is never the proxy itself.
export const db = new Proxy({}, {
  get(_target, prop) {
    const real = getDb();
    const value = real[prop];
    return typeof value === "function" ? value.bind(real) : value;
  },
});
