import { describe, it, expect } from "vitest";
import { eventSummary, eventDescription } from "@/lib/booking/event-text";

const base = {
  firstName: "Jordan",
  lastName: "Lee",
  email: "jordan@example.com",
  phone: "(714) 555-0100",
  role: "Buyer",
  notes: "Looking in Irvine",
  meetingType: "PHONE" as const,
  bookingSource: "CONTACT" as const,
};

describe("event text", () => {
  it("builds the summary", () => {
    expect(eventSummary({ ...base, role: "Home Buyer" })).toBe("Call with Jordan Lee (Home Buyer) – CnC");
  });

  it("includes contact details, source and phone line for phone calls", () => {
    const d = eventDescription(base);
    expect(d).toContain("jordan@example.com");
    expect(d).toContain("Contact phone: (714) 555-0100");
    expect(d).toContain("I am a: Buyer");
    expect(d).toContain("Looking in Irvine");
    expect(d).toContain("Booked from: Contact page");
    expect(d).toContain("Phone: (714) 555-0100");
  });

  it("omits the phone-call line for Meet and labels other sources", () => {
    const d = eventDescription({ ...base, meetingType: "MEET", bookingSource: "RECRUITING_EMAIL" });
    expect(d).not.toContain("Phone: ");
    expect(d).toContain("Booked from: Recruiting email");
    expect(eventDescription({ ...base, bookingSource: "JOIN" })).toContain("Booked from: Join page");
  });
});
