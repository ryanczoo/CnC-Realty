import { describe, it, expect } from "vitest";
import { emailMatchWhere } from "@/lib/email-match";

describe("emailMatchWhere (case-insensitive exact email match)", () => {
  it("matches regardless of capitalization", () => {
    expect(emailMatchWhere("John@Example.com")).toEqual({ email: { equals: "John@Example.com", mode: "insensitive" } });
  });

  it("escapes % and _ so an address can never act as a wildcard", () => {
    expect(emailMatchWhere("a%b_c@x.com")).toEqual({ email: { equals: "a\\%b\\_c@x.com", mode: "insensitive" } });
  });

  it("escapes a literal backslash too", () => {
    expect(emailMatchWhere("a\\b@x.com").email.equals).toBe("a\\\\b@x.com");
  });
});
