import { describe, it, expect } from "vitest";
import { reviewsPerView } from "@/lib/reviews-per-view";

describe("reviewsPerView", () => {
  it("desktop shows 3 reviews (unchanged)", () => {
    expect(reviewsPerView(1024)).toBe(3);
    expect(reviewsPerView(1440)).toBe(3);
  });
  it("wider phones and iPads show 2", () => {
    expect(reviewsPerView(640)).toBe(2);
    expect(reviewsPerView(844)).toBe(2);
    expect(reviewsPerView(1023)).toBe(2);
  });
  it("upright phones show 1", () => {
    expect(reviewsPerView(320)).toBe(1);
    expect(reviewsPerView(390)).toBe(1);
    expect(reviewsPerView(639)).toBe(1);
  });
});
