import type { NextConfig } from "next";

/**
 * Security headers (Prompt 11). CSP notes:
 * - 'unsafe-inline' for styles is required by Next.js and Tailwind runtime
 *   injection; scripts keep 'unsafe-inline' because the App Router inlines
 *   its bootstrap payload without a nonce setup.
 * - connect-src covers Supabase (REST, auth, realtime, storage) over the
 *   project subdomain wildcard; DeepSeek is only ever called server-side.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://*.supabase.co"} wss://*.supabase.co`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // @react-pdf/renderer ships pdfkit and friends with dynamic requires that
  // must stay outside the server bundle.
  serverExternalPackages: ["@react-pdf/renderer"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
