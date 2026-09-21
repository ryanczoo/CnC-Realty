import { describe, it, expect, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { isFileLocked, isFileReadOnlyFor } from "@/lib/file-lock";
import { assertFileEditable } from "@/lib/api-auth";
import { FILE_LOCKED_MESSAGE, EMAIL_WARNING_TEXT } from "@/lib/file-messages";

describe("isFileLocked", () => {
  it.each(["CLOSED", "ARCHIVED", "CANCELED_APPROVED"])("locks a transaction that is %s", (s) => {
    expect(isFileLocked("transaction", s)).toBe(true);
  });
  it.each(["INCOMPLETE", "PRE_CONTRACT", "PENDING", "EXPIRED", "CANCELED_PENDING", "PENDING_TRANSFER", "REFERRAL_SUCCESSFUL", "REFERRAL_BROKER_REVIEW"])(
    "leaves a transaction that is %s editable",
    (s) => { expect(isFileLocked("transaction", s)).toBe(false); }
  );
  it.each(["CLOSED", "CANCELED"])("locks a listing that is %s", (s) => {
    expect(isFileLocked("listing", s)).toBe(true);
  });
  it.each(["INCOMPLETE", "COMING_SOON", "ACTIVE", "ACTIVE_UNDER_CONTRACT", "EXPIRED", "WITHDRAWN", "PENDING_TRANSFER"])(
    "leaves a listing that is %s editable",
    (s) => { expect(isFileLocked("listing", s)).toBe(false); }
  );
  it("does not lock when the status is missing", () => {
    expect(isFileLocked("transaction", undefined)).toBe(false);
    expect(isFileLocked("listing", null)).toBe(false);
  });
  it("does not treat an archived listing status as locked (listings have no ARCHIVED)", () => {
    expect(isFileLocked("listing", "ARCHIVED")).toBe(false);
  });
});

describe("isFileReadOnlyFor", () => {
  it("is read-only for an agent on a closed file", () => {
    expect(isFileReadOnlyFor("transaction", "CLOSED", "AGENT")).toBe(true);
  });
  it("is never read-only for an admin", () => {
    expect(isFileReadOnlyFor("transaction", "CLOSED", "ADMIN")).toBe(false);
  });
  it("is editable for an agent on an open file", () => {
    expect(isFileReadOnlyFor("listing", "ACTIVE", "AGENT")).toBe(false);
  });
});

describe("assertFileEditable", () => {
  it("returns a 403 with the lock message for an agent on a closed file", async () => {
    const res = assertFileEditable("transaction", "CLOSED", "AGENT");
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    expect((await res!.json()).error).toBe("This file is closed and can't be changed");
  });
  it("returns null for an admin on a closed file", () => {
    expect(assertFileEditable("transaction", "CLOSED", "ADMIN")).toBeNull();
  });
  it("returns null for an agent on an open file", () => {
    expect(assertFileEditable("listing", "ACTIVE", "AGENT")).toBeNull();
  });
});

describe("shared messages", () => {
  it("uses the exact wording agreed with Ryan", () => {
    expect(FILE_LOCKED_MESSAGE).toBe("This file is closed and can't be changed");
    expect(EMAIL_WARNING_TEXT).toBe("Saved, but the email to the agent couldn't be sent.");
  });
});
