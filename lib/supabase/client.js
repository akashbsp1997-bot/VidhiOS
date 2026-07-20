// lib/supabase/client.js
//
// Supabase client for Client Components (browser) -- used by the login page
// to call supabase.auth.signInWithPassword / signUp directly from the form.

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
