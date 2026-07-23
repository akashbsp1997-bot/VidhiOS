import "./globals.css";
import LogoutButton from "../components/LogoutButton.jsx";
import { getSessionUserId } from "../lib/supabase/server.js";

export const metadata = {
  title: "VidhiOS Adaptive — Law Optional Mastery Engine",
  description: "Subtopic-by-subtopic adaptive practice for UPSC CSE Law Optional, grounded in official sources and real PYQs.",
};

export default async function RootLayout({ children }) {
  const userId = await getSessionUserId();

  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="inner">
            <a className="brand" href="/">
              <b>Vidhi</b>OS <span style={{ fontSize: 13, opacity: 0.7 }}>Adaptive</span>
            </a>
            {userId && (
              <nav className="toplinks" style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <a href="/">Dashboard</a>
                <a href="/plan">Plan</a>
                <a href="/guide">Guide</a>
                <a href="/practice">Practice</a>
                <LogoutButton />
              </nav>
            )}
          </div>
        </header>
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
