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
    "Every transaction, sealed before you sign. AI-powered DeFi copilot on Sui.",
  metadataBase: new URL("https://dewlock.xyz"),
  openGraph: {
    title: "Dewlock — Sui DeFi Copilot",
    description: "Every transaction, sealed before you sign.",
    type: "website",
  },
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
