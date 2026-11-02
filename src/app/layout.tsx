import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, IM_Fell_English } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fell = IM_Fell_English({ variable: "--font-fell", weight: "400", style: ["normal", "italic"], subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: "Revenant: some links come back wrong", template: "%s · Revenant" },
  description:
    "Revenant finds cited links that still answer 200 OK but now lead to squatters, soft 404s and rewritten pages, then raises the original from the Internet Archive, checked against the sentence that cites it.",
  openGraph: {
    title: "Revenant: some links come back wrong",
    description: "Find possessed, ghost and changeling citations that status-code checkers call alive, and raise the originals from the archive.",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#0b0a0e", colorScheme: "dark" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${fell.variable} h-full antialiased`}>
      <body className="grain flex min-h-full flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-candle focus:px-3 focus:py-2 focus:text-ink">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
