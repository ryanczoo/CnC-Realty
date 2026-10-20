// Same statuses, in the same order, as the search page's filter — the order is part of its cache key.
// Kept in its own dependency-free module so pure helpers (lib/json-ld.ts) can use it without pulling in Prisma/Redis.
export const ACTIVE_STATUSES = ["Active", "ComingSoon", "ActiveUnderContract"];
