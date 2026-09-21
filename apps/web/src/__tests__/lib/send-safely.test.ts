import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import * as Sentry from "@sentry/nextjs";
import { sendSafely } from "@/lib/email/send-safely";

describe("sendSafely", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns failed: false and logs nothing when the send succeeds", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    await expect(sendSafely(send)).resolves.toEqual({ failed: false });
    expect(send).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("returns failed: true and logs to Sentry when the send throws", async () => {
    const error = new Error("Postmark 406: inactive recipient");
    await expect(sendSafely(() => Promise.reject(error))).resolves.toEqual({ failed: true });
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it("never throws, even when the send throws synchronously", async () => {
    await expect(sendSafely(() => { throw new Error("boom"); })).resolves.toEqual({ failed: true });
  });
});
