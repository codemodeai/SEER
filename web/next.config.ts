import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.razorpay.com https://*.razorpay.com https://open.er-api.com https://live.dodopayments.com https://test.dodopayments.com https://*.checkout.dodopayments.com",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  async redirects() {
    return [
      // Dashboard moved to desktop app
      {
        source: "/dashboard",
        destination: "/download",
        permanent: false,
      },
      {
        source: "/dashboard/:path*",
        destination: "/download",
        permanent: false,
      },
      // Agency portal moved to desktop app
      {
        source: "/agency/:path*",
        destination: "/download",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
