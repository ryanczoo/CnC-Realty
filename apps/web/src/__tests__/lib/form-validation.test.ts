import { describe, it, expect } from "vitest";
import { formatPhoneInput, isValidEmail } from "@/lib/form-validation";

describe("formatPhoneInput", () => {
  it("returns digits as-is when 3 or fewer", () => {
    expect(formatPhoneInput("555")).toBe("555");
  });

  it("inserts a dash after the 3rd digit once a 4th digit is typed", () => {
    expect(formatPhoneInput("5551")).toBe("555-1");
  });

  it("inserts a second dash after the 6th digit once a 7th digit is typed", () => {
    expect(formatPhoneInput("5551234")).toBe("555-123-4");
  });

  it("formats a complete 10-digit number as XXX-XXX-XXXX", () => {
    expect(formatPhoneInput("5551234567")).toBe("555-123-4567");
  });

  it("strips non-digit characters before formatting", () => {
    expect(formatPhoneInput("(555) 123-4567")).toBe("555-123-4567");
  });

  it("caps input at 10 digits, ignoring anything typed beyond that", () => {
    expect(formatPhoneInput("55512345678888")).toBe("555-123-4567");
  });
});

describe("isValidEmail", () => {
  it("accepts a well-formed email address", () => {
    expect(isValidEmail("test@example.com")).toBe(true);
  });

  it("rejects an email missing a domain extension", () => {
    expect(isValidEmail("testlee@gmail")).toBe(false);
  });

  it("rejects an email missing the @ symbol", () => {
    expect(isValidEmail("testleegmail.com")).toBe(false);
  });

  it("rejects an email with a space", () => {
    expect(isValidEmail("test lee@gmail.com")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });
});
