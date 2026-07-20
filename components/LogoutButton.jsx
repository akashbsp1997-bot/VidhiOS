"use client";

import { useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/client.js";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button className="btn" style={{ padding: "6px 12px", fontSize: 13 }} onClick={handleLogout}>
      Log out
    </button>
  );
}
