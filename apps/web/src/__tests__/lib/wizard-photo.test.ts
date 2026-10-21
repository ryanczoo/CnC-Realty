import { describe, it, expect } from "vitest";
import { isOwnWizardPhoto, wizardPhotoPrefix, PHOTO_MAX_BYTES, PHOTO_TYPES } from "@/lib/wizard-photo";

describe("wizard photo keys", () => {
  it("puts each user's photos under their own prefix", () => {
    expect(wizardPhotoPrefix("u1")).toBe("wizard-photos/u1/");
  });

  it("accepts the caller's own shrunk photo", () => {
    expect(isOwnWizardPhoto("wizard-photos/u1/abc/photo.jpg", "u1")).toBe(true);
  });

  it.each([
    ["another user's photo", "wizard-photos/u2/abc/photo.jpg"],
    ["the unshrunk original", "wizard-photos/u1/abc/original"],
    ["a document key", "transactions/listing/l1/d1/photo.jpg"],
    ["a path climbing out", "wizard-photos/u1/../u2/abc/photo.jpg"],
  ])("rejects %s", (_label, key) => {
    expect(isOwnWizardPhoto(key, "u1")).toBe(false);
  });

  it("allows JPG and PNG up to 20MB", () => {
    expect(PHOTO_TYPES).toEqual(["image/jpeg", "image/png"]);
    expect(PHOTO_MAX_BYTES).toBe(20 * 1024 * 1024);
  });
});
