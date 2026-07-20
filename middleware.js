// middleware.js
//
// Refreshes the Supabase session cookie on every request (standard
// @supabase/ssr pattern -- without this, server-side auth checks in API
// routes/Server Components see a stale/expired session) and gates the app
// behind login. Routes with their own secret-based gate (SETUP_SECRET,
// CRON_SECRET) are explicitly excluded -- they're operator/cron-triggered,
// not visited by a logged-in browser session, and cookie-redirect logic
// doesn't apply to them.

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/login", "/auth/callback"];
// "/api/ingest" is gated by its own SETUP_SECRET check (see app/api/ingest/*),
// same as "/api/setup"/"/api/migrate" -- it's called by app/ingest/* pages
// that already require login, but the underlying admin operation itself is
// operator-secret-gated, not session-gated, so it's listed here too.
const PUBLIC_API_PREFIXES = ["/api/setup", "/api/migrate", "/api/cron", "/api/ingest"];

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.includes(pathname) || PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next's static/image internals and common static
    // file extensions -- deliberately broad so no page/route is
    // accidentally left unguarded by omission.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
