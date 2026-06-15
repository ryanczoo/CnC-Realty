import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

export const publicFormRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"),
  prefix: "ratelimit:public",
});
