// Which pages get the see-through navbar (white logo over a photo/video hero) versus the solid
// black bar. Used by the shared Navbar. Pages with a plain off-white top must be solid, or the
// white logo and buttons disappear against the background.
const SOLID_PATHS = new Set([
  "/contact",
  "/login",
  "/register",
  "/forgot-password",
  "/accessibility",
  "/privacy",
  "/terms",
  "/fair-housing",
  "/join/apply",
  "/join/apply/submitted",
  "/join/ica",
  "/setup-account",
  "/unsubscribe",
  "/home-value",
  "/booking/manage", // the meeting Manage page from booking emails (not /manage, Property Management)
]);

const SOLID_PREFIXES = ["/dashboard", "/admin", "/account", "/agents/"];

export function isTransparentNavPath(pathname: string): boolean {
  if (SOLID_PREFIXES.some((p) => pathname.startsWith(p))) return false;
  return !SOLID_PATHS.has(pathname);
}
