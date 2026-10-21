import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Free plan has 50 replays/month: spend them only on sessions that hit an error.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],
  // Browser-extension noise, not our code (e.g. CNC-REALTY-2C "Failed to connect to MetaMask").
  ignoreErrors: [/MetaMask/i],
  denyUrls: [/^chrome-extension:\/\//, /^moz-extension:\/\//, /^safari-web-extension:\/\//, /^app:\/\/\/scripts\/inpage\.js/],
});
