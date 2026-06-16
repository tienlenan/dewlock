import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Providers } from "./providers";
import { SmoothScrollProvider } from "@/components/smooth-scroll-provider";
import "./globals.css";

// Plus Jakarta Sans — display + body font. Variable weight for flexibility.
// Loaded via next/font (auto-hosted, no external network request at runtime).
const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

// JetBrains Mono — monospace for addresses, digests, amounts, labels.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dewlock — Sui DeFi Copilot",
  description:
    "Every transaction, sealed before you sign. Dewlock is an AI-powered DeFi copilot on Sui " +
    "with a nine-gate Guardian that verifies, dry-runs, and receipts every action before you sign.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://dewlock.xyz",
  ),
  keywords: [
    "Sui", "DeFi", "AI copilot", "transaction guard", "DeepBook",
    "Walrus receipt", "WYSIWYS", "Cetus swap", "SuiNS",
  ],
  openGraph: {
    title: "Dewlock — Sui DeFi Copilot",
    description: "Every transaction, sealed before you sign.",
    type: "website",
    url: "/",
    siteName: "Dewlock",
    // og:image served from /opengraph-image route (Next auto-discovery).
  },
  twitter: {
    card: "summary_large_image",
    title: "Dewlock — Sui DeFi Copilot",
    description: "Every transaction, sealed before you sign.",
    // twitter:image auto-resolved from /opengraph-image if present.
  },
  // Robots: index on prod; next.config can override via headers.
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      // Jakarta + JetBrains CSS variables available globally via --font-jakarta / --font-jetbrains
      className={`${jakartaSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        {/* next-themes: light default; class strategy for Tailwind dark variant */}
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {/* Sui wallet + React Query providers (client component tree) */}
          <Providers>
            {/* Lenis smooth scroll — wraps the full page */}
            <SmoothScrollProvider>{children}</SmoothScrollProvider>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
