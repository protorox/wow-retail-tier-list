import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const headingFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "700"]
});

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"]
});

export const metadata: Metadata = {
  title: "WoW Retail Tier List",
  description: "Live, data-driven tier lists for World of Warcraft Retail"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${headingFont.variable} ${bodyFont.variable}`}>
      <body className="font-[var(--font-body)] antialiased">
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-8 pt-6 sm:px-6 lg:px-8">
          <header className="mb-6 flex items-center justify-between rounded-2xl border bg-white/70 px-4 py-3 backdrop-blur">
            <div>
              <h1 className="font-[var(--font-heading)] text-xl font-bold">WoW Retail Tier List</h1>
              <p className="text-xs text-muted-foreground">Live snapshots from Raider.IO + Warcraft Logs</p>
            </div>
            <nav className="flex items-center gap-2 text-sm">
              <Link href="/" className="rounded-md px-3 py-1.5 hover:bg-secondary">
                Tier List
              </Link>
              <Link href="/admin" className="rounded-md px-3 py-1.5 hover:bg-secondary">
                Admin
              </Link>
            </nav>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
