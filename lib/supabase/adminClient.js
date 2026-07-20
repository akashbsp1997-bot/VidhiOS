// lib/supabase/adminClient.js
//
// Service-role Supabase client -- bypasses Row Level Security, used ONLY by
// server-side ingest routes (app/api/ingest/*, app/api/setup/storage) that
// need to write to Storage on the operator's behalf. Never import this into
// a Client Component or any code path reachable from the browser -- that's
// what lib/supabase/client.js (anon key, safe to expose) is for.

import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set. Add SUPABASE_SERVICE_ROLE_KEY (Supabase Project Settings -> API -> service_role secret) to your Vercel project's environment variables. See README."
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
