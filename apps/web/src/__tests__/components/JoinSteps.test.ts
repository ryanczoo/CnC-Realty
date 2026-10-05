import { describe, it, expect } from "vitest";
import { photoInView } from "@/components/join/JoinSteps";

describe("photoInView", () => {
  it("picks the photo whose centre is closest to the target line", () => {
    expect(photoInView([100, 500, 900], 480)).toBe(1);
    expect(photoInView([100, 500, 900], 120)).toBe(0);
    expect(photoInView([100, 500, 900], 2000)).toBe(2);
  });
  it("ties resolve to the earlier photo", () => {
    expect(photoInView([100, 300], 200)).toBe(0);
  });
});
