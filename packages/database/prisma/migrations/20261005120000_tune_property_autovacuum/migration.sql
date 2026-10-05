-- Keep the Property table's visibility map current so the search page's
-- listing count stays an index-only scan. With Postgres's default 20% scale
-- factor, a 4M-row table needs ~800k changed rows before autovacuum runs, and
-- the 15-minute IDX delta sync never reaches that — the count degraded to a
-- ~115s heap scan (2026-10-05). 2% ≈ 80k changed rows triggers a vacuum.
-- Storage parameters only: no schema, data, or index change.
ALTER TABLE "Property" SET (
  autovacuum_vacuum_scale_factor = 0.02,
  autovacuum_vacuum_insert_scale_factor = 0.02,
  autovacuum_analyze_scale_factor = 0.02
);
