// lib/supabase/server.js
//
// Supabase client for use in Server Components, Route Handlers, and
// middleware.js -- reads/writes the session via Next's cookie store rather
// than localStorage (the browser-client approach), which is what lets
// middleware.js and API routes see who's logged in on every request.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component that can't set cookies (no
          // response to attach them to) -- safe to ignore as long as
          // middleware.js is refreshing the session on every request.
        }
      },
    },
  });
}

/**
 * Convenience helper for API routes: returns the authenticated user's id, or
 * null if there isn't one. Route handlers should treat null as "return 401",
 * not attempt any mastery/attempts query with it.
 */
export async function getSessionUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
