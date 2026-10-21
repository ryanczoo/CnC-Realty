import { describe, it, expect } from "vitest";
import { activityLabel } from "@/components/transactions/ActivityFeed";

const removed = (payload: Record<string, unknown>) => ({ type: "DOCUMENT_REMOVED", payload }) as any;

describe("activityLabel", () => {
  it("says a checklist document came off the checklist", () => {
    expect(activityLabel(removed({ name: "nhd.pdf", checklistItemName: "NHD — Natural Hazard Disclosure Report" }))).toBe("Document removed from checklist");
  });

  it("says an additional document came off Additional Documents", () => {
    expect(activityLabel(removed({ name: "pest.pdf", checklistItemName: null }))).toBe("Document removed from Additional Documents");
  });

  it("keeps the plain label for other activity", () => {
    expect(activityLabel({ type: "DOCUMENT_APPROVED", payload: null } as any)).toBe("Document approved");
  });
});
