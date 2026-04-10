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
  metadataBase: new URL("https://seermcp.com"),
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "SEER",
              applicationCategory: "DeveloperApplication",
              operatingSystem: "Cross-platform",
              description:
                "AI Prompt Intelligence Platform — optimizes prompts, generates workflows, and manages project memory for Claude Code via MCP.",
              url: "https://seermcp.com",
              image: "https://seermcp.com/og-image.png",
              offers: [
                {
                  "@type": "Offer",
                  name: "Free",
                  price: "0",
                  priceCurrency: "USD",
                  description: "50 calls/month, prompt optimization",
                },
                {
                  "@type": "Offer",
                  name: "Starter",
                  price: "19",
                  priceCurrency: "USD",
                  description: "200 calls/month, workflows, Founder's Space",
                },
                {
                  "@type": "Offer",
                  name: "Pro",
                  price: "49",
                  priceCurrency: "USD",
                  description:
                    "1,000 calls/month, context memory, priority support",
                },
                {
                  "@type": "Offer",
                  name: "Agency",
                  price: "59",
                  priceCurrency: "USD",
                  description:
                    "Unlimited calls, team workspace, shared memory",
                },
              ],
              creator: {
                "@type": "Organization",
                name: "SEER",
                url: "https://seermcp.com",
                logo: "https://seermcp.com/logo.png",
              },
            }),
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
