// The message shown right under a form field when its value is invalid (e.g.
// emailError's "Please enter a valid email address.") — every such message on
// the site renders through this so they all look the same. Renders nothing when
// there's no message.
export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-500">{message}</p>;
}
