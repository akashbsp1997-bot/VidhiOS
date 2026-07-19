import "./globals.css";

export const metadata = {
  title: "VidhiOS Adaptive — Law Optional Mastery Engine",
  description: "Subtopic-by-subtopic adaptive practice for UPSC CSE Law Optional, grounded in official sources and real PYQs.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <div className="inner">
            <a className="brand" href="/">
              <b>Vidhi</b>OS <span style={{ fontSize: 13, opacity: 0.7 }}>Adaptive</span>
            </a>
            <nav className="toplinks">
              <a href="/">Dashboard</a>
              <a href="/practice">Practice</a>
            </nav>
          </div>
        </header>
        <div className="shell">{children}</div>
      </body>
    </html>
  );
}
