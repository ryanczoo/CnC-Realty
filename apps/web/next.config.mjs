import { withSentryConfig } from "@sentry/nextjs";
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prisma lives in packages/database; without this plugin the file tracer can
  // leave its query engine out of the server bundle when deployed from a monorepo.
  webpack: (config, { isServer }) => {
    if (isServer) config.plugins = [...config.plugins, new PrismaPlugin()];
    return config;
  },
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverComponentsExternalPackages: ["isomorphic-dompurify", "jsdom"],
    // These two routes read static PDFs off disk via readFileSync rather than an
    // import, so they are not part of the module graph Next bundles from.
    // As of this Next version the file tracer does infer them (verified against a
    // control build with this block removed — all four PDFs were still traced),
    // because the paths are `join()` of literals off process.cwd(). That inference
    // is an implementation detail, not a guarantee: this block states the
    // dependency explicitly so a tracer change can't silently ship a function
    // bundle that 500s on the first transfer-form download.
    outputFileTracingIncludes: {
      "/api/transfer-forms/[type]": ["./src/lib/email/attachments/**"],
      "/api/agent-applications/[id]/approve": ["./src/lib/email/attachments/**"],
    },
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  tunnelRoute: "/monitoring",
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
});
