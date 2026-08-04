export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  shouldRetry?: (err: unknown) => boolean;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 4;
  const baseDelayMs = opts.baseDelayMs ?? 1000;
  const sleep = opts.sleep ?? defaultSleep;
  const shouldRetry = opts.shouldRetry ?? (() => true);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts || !shouldRetry(err)) throw err;
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }
  throw new Error("unreachable");
}
