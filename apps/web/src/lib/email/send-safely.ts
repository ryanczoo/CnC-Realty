import * as Sentry from "@sentry/nextjs";

// Runs an email send without letting a delivery problem break the action that
// triggered it. The database change has already happened by the time we send,
// so a failure is logged and reported back, never thrown.
export async function sendSafely(send: () => Promise<unknown>): Promise<{ failed: boolean }> {
  try {
    await send();
    return { failed: false };
  } catch (err) {
    Sentry.captureException(err);
    return { failed: true };
  }
}
