import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "IPO Fund Dashboard",
  description: "Personal IPO Tracking & Multi-Account Fund Allocation Dashboard",
};

// Runs synchronously before first paint (a blocking inline script in <head>,
// not a React effect) so the dark class is already on <html> by the time
// anything renders — without this, ThemeProvider's own effect only fires
// after mount, giving anyone with dark mode saved/preferred a flash of the
// light theme on every full page load.
const THEME_INIT_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem("theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
