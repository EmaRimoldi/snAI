import type { NextConfig } from "next";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://zgfanoruqwftbqhhvtwg.supabase.co";

// When the real engine is enabled (NEXT_PUBLIC_ENGINE=http://...), its origin
// must be allowed by connect-src or the browser blocks the /extract calls.
const ENGINE = process.env.NEXT_PUBLIC_ENGINE ?? "mock";
const ENGINE_ORIGIN = ENGINE.startsWith("http") ? new URL(ENGINE).origin : "";

const isDev = process.env.NODE_ENV === "development";

// Next.js needs inline scripts for hydration; dev mode additionally needs eval.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `connect-src 'self' ${SUPABASE_URL}${ENGINE_ORIGIN ? ` ${ENGINE_ORIGIN}` : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
