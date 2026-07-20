// app/auth/callback/route.js
//
// Supabase redirects here after an email confirmation link is clicked (if
// email confirmation is enabled on the project), with a `code` param to
// exchange for a real session.

import { NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server.js";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
