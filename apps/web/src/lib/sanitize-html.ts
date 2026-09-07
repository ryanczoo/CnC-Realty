import DOMPurify from "isomorphic-dompurify";

// Every place in this app that renders agent-authored or admin-authored
// rich text via dangerouslySetInnerHTML must go through this first — blog
// posts reach the public site, campaign bodies reach an admin's session via
// checkOwnership's admin bypass. DOMPurify's default allowlist already
// covers everything Tiptap's StarterKit can produce (p, strong, em, ul, ol,
// li, a, br, h1-h6, blockquote, code) while stripping script tags and
// event-handler attributes.
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html);
}
