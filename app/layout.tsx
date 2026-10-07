import type { Metadata } from "next";
import { Syne, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import Link from "next/link";

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vibe Hackathon — Vibe coding competition for agentic devs",
  description:
    "A vibe coding competition where teams use AI agents to build working applications. Submit your project, get judged, win.",
  openGraph: {
    title: "Vibe Hackathon",
    description: "Vibe coding competition for agentic devs",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="dark-professional"
      className={`${syne.variable} ${jakarta.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Prevent theme flash on load */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("vibe-theme");if(t)document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen flex flex-col">
        <ThemeProvider>
          {children}
          <footer className="border-t" style={{ borderColor: "var(--color-border)" }}>
            <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 flex items-center justify-between gap-4 flex-wrap" style={{ color: "var(--color-subtle)", fontSize: "0.8125rem" }}>
              <span>© {new Date().getFullYear()} Vibe Hackathon</span>
              <div className="flex items-center gap-4">
                <Link href="/projects" style={{ color: "inherit", textDecoration: "none" }}>Projects</Link>
                <Link href="/submit" style={{ color: "inherit", textDecoration: "none" }}>Submit</Link>
                <Link href="/login" style={{ color: "inherit", textDecoration: "none" }}>Log in</Link>
              </div>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
