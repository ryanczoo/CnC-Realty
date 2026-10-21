// Property photos picked in the New Listing / New Transaction wizards. The file
// doesn't exist yet when the photo is chosen, so photos live under the
// uploader's own prefix instead of a file's, and the create routes accept only
// a key from the caller's own prefix (never another file's document).
export const PHOTO_TYPES = ["image/jpeg", "image/png"];
export const PHOTO_MAX_BYTES = 20 * 1024 * 1024;

export function wizardPhotoPrefix(userId: string): string {
  return `wizard-photos/${userId}/`;
}

// The shrunk photo the process route stores: wizard-photos/<userId>/<id>/photo.jpg
export function isOwnWizardPhoto(key: string, userId: string): boolean {
  return key.startsWith(wizardPhotoPrefix(userId)) && key.endsWith("/photo.jpg") && !key.includes("..");
}
