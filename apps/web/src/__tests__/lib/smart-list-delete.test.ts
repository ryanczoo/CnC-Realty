import { describe, it, expect } from "vitest";
import { confirmListDelete } from "@/lib/smart-list-delete";
import { MOBILE_QUERY } from "@/hooks/useIsMobile";

function fakeWindow(isPhone: boolean, answer: boolean) {
  const asked: string[] = [];
  const queries: string[] = [];
  return {
    asked,
    queries,
    win: {
      matchMedia: (q: string) => { queries.push(q); return { matches: isPhone } as MediaQueryList; },
      confirm: (msg?: string) => { asked.push(msg ?? ""); return answer; },
    },
  };
}

describe("custom smart list delete confirm", () => {
  it("desktop deletes right away, exactly as before (no dialog)", () => {
    const f = fakeWindow(false, false);
    expect(confirmListDelete("My Hot Buyers", f.win)).toBe(true);
    expect(f.asked).toEqual([]);
  });

  it("phones ask first, naming the list, and use the site's one phone cutoff", () => {
    const f = fakeWindow(true, true);
    expect(confirmListDelete("My Hot Buyers", f.win)).toBe(true);
    expect(f.asked).toEqual(['Delete the list "My Hot Buyers"? This cannot be undone.']);
    expect(f.queries).toEqual([MOBILE_QUERY]);
  });

  it("phones keep the list when the agent taps Cancel", () => {
    const f = fakeWindow(true, false);
    expect(confirmListDelete("My Hot Buyers", f.win)).toBe(false);
  });
});
