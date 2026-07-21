import { describe, it, expect } from "vitest";
import { formatPhoneInput, isValidEmail, limitDigits, stripDigits, digitsOnly } from "@/lib/form-validation";

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

describe("limitDigits", () => {
  it("returns the value unchanged when digit count is under the max", () => {
    expect(limitDigits("12", 5)).toBe("12");
  });

  it("truncates further digits once the max digit count is reached", () => {
    expect(limitDigits("123456", 5)).toBe("12345");
  });

  it("caps beds/baths-style input at 2 digits", () => {
    expect(limitDigits("123", 2)).toBe("12");
  });

  it("preserves a decimal point while still counting only digits toward the max", () => {
    expect(limitDigits("12.5", 2)).toBe("12.");
  });

  it("drops digits after the max even past a decimal point", () => {
    expect(limitDigits("1.2345", 2)).toBe("1.2");
  });

  it("returns an empty string unchanged", () => {
    expect(limitDigits("", 5)).toBe("");
  });
});

describe("stripDigits", () => {
  it("removes digit characters from a city name typed with numbers", () => {
    expect(stripDigits("222222222222")).toBe("");
  });

  it("removes digits interspersed with letters", () => {
    expect(stripDigits("L0s Ang3les")).toBe("Ls Angles");
  });

  it("preserves spaces, hyphens, apostrophes, and periods for real city names", () => {
    expect(stripDigits("St. Louis")).toBe("St. Louis");
    expect(stripDigits("Winston-Salem")).toBe("Winston-Salem");
    expect(stripDigits("Coeur d'Alene")).toBe("Coeur d'Alene");
  });

  it("returns a clean city name unchanged", () => {
    expect(stripDigits("Los Angeles")).toBe("Los Angeles");
  });
});

describe("digitsOnly", () => {
  it("strips all non-digit characters", () => {
    expect(digitsOnly("9(53)70", 5)).toBe("95370");
  });

  it("caps at maxLength, ignoring anything typed beyond that", () => {
    expect(digitsOnly("123456789", 5)).toBe("12345");
  });

  it("caps a 10-digit MLS number correctly, rejecting an 11th digit", () => {
    expect(digitsOnly("116955982412", 10)).toBe("1169559824");
  });

  it("caps a 4-digit year built field, rejecting a 5th digit", () => {
    expect(digitsOnly("20055", 4)).toBe("2005");
  });

  it("returns an empty string unchanged", () => {
    expect(digitsOnly("", 5)).toBe("");
  });
});
