import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const isDev = process.env.NODE_ENV === "development";

// Origins the browser legitimately talks to. Supabase comes from the project
// URL (auth + PostgREST from client components); Sentry's ingest host is a
// region-dependent subdomain, so it's allowed by parent domain. PostHog is
// server-side only and needs nothing here.
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : "";
const supabaseWs = supabaseOrigin.replace(/^http/, "ws");

const csp = [
  "default-src 'self'",
  // 'unsafe-inline' is required for Next's inline hydration scripts without
  // per-request nonces; 'unsafe-eval' only in dev (React debug tooling).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  [
    "connect-src 'self'",
    supabaseOrigin,
    supabaseWs,
    "https://*.sentry.io",
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

// Source maps upload only when SENTRY_AUTH_TOKEN is set (production builds on
// Vercel); everywhere else the wrapper is inert.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  silent: !process.env.CI,
  telemetry: false,
});
