import { describe, it, expect, vi } from "vitest";
import { withRetry } from "@/lib/idx/retry";

describe("withRetry", () => {
  it("retries a failing operation until it succeeds", async () => {
    let attempts = 0;
    const operation = async () => {
      attempts++;
      if (attempts < 3) throw new Error("transient failure");
      return "success";
    };

    const result = await withRetry(operation, { sleep: async () => {} });

    expect(result).toBe("success");
    expect(attempts).toBe(3);
  });

  it("throws the last error after exhausting maxAttempts", async () => {
    const operation = async () => {
      throw new Error("permanent-looking failure");
    };

    await expect(
      withRetry(operation, { maxAttempts: 3, sleep: async () => {} })
    ).rejects.toThrow("permanent-looking failure");
  });

  it("does not retry when shouldRetry returns false for the thrown error", async () => {
    let attempts = 0;
    class NonRetryableError extends Error {}
    const operation = async () => {
      attempts++;
      throw new NonRetryableError("config error");
    };

    await expect(
      withRetry(operation, {
        maxAttempts: 5,
        sleep: async () => {},
        shouldRetry: (err) => !(err instanceof NonRetryableError),
      })
    ).rejects.toThrow("config error");
    expect(attempts).toBe(1);
  });

  it("waits with exponential backoff between attempts", async () => {
    let attempts = 0;
    const operation = async () => {
      attempts++;
      if (attempts < 3) throw new Error("fail");
      return "ok";
    };
    const sleepCalls: number[] = [];
    const sleep = vi.fn(async (ms: number) => {
      sleepCalls.push(ms);
    });

    await withRetry(operation, { baseDelayMs: 100, sleep });

    expect(sleepCalls).toEqual([100, 200]);
  });
});
