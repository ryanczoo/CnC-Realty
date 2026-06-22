# Task 2 Report — Tag & Lead Export Utilities

**Status:** DONE

## Commits Made
- `45d6664` — feat(lib): add applyTag utility and leadsToCSV helper

## Test Summary
TypeScript compilation successful (`pnpm --filter web build` exit 0). No type errors in new files. All functions correctly typed with strict mode enabled.

## Files Created
1. **`apps/web/src/lib/tags.ts`** (17 lines)
   - `applyTag(leadId, tagName)`: Upserts tag, applies to lead via leadTag junction table
   - `removeTag(leadId, tagId)`: Removes tag from lead

2. **`apps/web/src/lib/lead-export.ts`** (45 lines)
   - `LeadRow` type: Full lead schema with nested relations (tags, agent.user)
   - `leadsToCSV(leads)`: RFC 4180 compliant CSV export with proper quote escaping for commas/newlines/quotes

## Implementation Details
- Tag upsert pattern prevents duplicates and handles lead-tag association idempotently
- CSV escape function handles all three RFC 4180 edge cases: comma, quote, newline
- Types use `null` for optional fields (strict null checking)
- No `any` types used; full TypeScript strict mode compliance

## Next Steps
- These utilities will be consumed by `/api/leads/export` (GET) and `/api/leads/[id]/tags` (POST/DELETE) endpoints in Phase 3
- Integration test with actual Prisma lead records recommended before production use
