import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Origins the browser legitimately talks to. Supabase comes from the project
// URL (auth + PostgREST from client components); Sentry and PostHog ingest
// hosts are region-dependent subdomains, so they're allowed by parent domain.
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : "";
const supabaseWs = supabaseOrigin.replace(/^http/, "ws");

const csp = [
  "default-src 'self'",
  // 'unsafe-inline' is required for Next's inline hydration scripts without
  // per-request nonces; 'unsafe-eval' only in dev (React debug tooling).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://*.posthog.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.posthog.com",
  "font-src 'self'",
  [
    "connect-src 'self'",
    supabaseOrigin,
    supabaseWs,
    "https://*.sentry.io",
    "https://*.posthog.com",
    isDev ? "ws://localhost:* ws://127.0.0.1:*" : "",
  ]
    .filter(Boolean)
    .join(" "),
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  isDev ? "" : "upgrade-insecure-requests",
]
  .filter(Boolean)
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
