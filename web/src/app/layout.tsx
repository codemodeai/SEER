import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SEER — AI Prompt Intelligence Platform",
  description:
    "Optimize every prompt. Structure every workflow. Remember every context. SEER is the MCP server that makes Claude Code smarter.",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "SEER — AI Prompt Intelligence Platform",
    description:
      "Optimize every prompt. Structure every workflow. Remember every context. SEER is the MCP server that makes Claude Code smarter.",
    url: "https://seermcp.com",
    siteName: "SEER",
    images: [
      {
        url: "https://seermcp.com/og-image.png",
        width: 250,
        height: 250,
        alt: "SEER Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "SEER — AI Prompt Intelligence Platform",
    description:
      "Optimize every prompt. Structure every workflow. Remember every context.",
    images: ["https://seermcp.com/og-image.png"],
  },
  other: {
    "theme-color": "#D97757",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
