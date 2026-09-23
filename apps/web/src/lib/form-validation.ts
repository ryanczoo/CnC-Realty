export function formatPhoneInput(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Shared inline-field-error check for optional email fields: blank is fine
// (these fields are never required), but non-blank, malformed input is
// flagged with the same message used everywhere else on the site an email
// gets validated. Returns undefined when there's nothing to show.
export function emailError(value: string): string | undefined {
  if (!value.trim()) return undefined;
  return isValidEmail(value) ? undefined : "Please enter a valid email address.";
}

export function stripDigits(value: string): string {
  return value.replace(/\d/g, "");
}

export function digitsOnly(value: string, maxLength: number): string {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

// Inserts thousands-separator commas into a plain whole-digit string, e.g.
// "800000" -> "800,000". Used as the integer-part formatter inside
// formatCurrencyDisplay below, and standalone for whole-number-only fields.
export function formatWithCommas(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Sanitizes free-typed currency input down to digits and at most one decimal
// point, capping the integer portion at maxIntDigits and the decimal portion
// at 2 digits (cents). A trailing "." with nothing after it yet is kept
// as-is, so live-typing a decimal amount isn't interrupted mid-entry.
export function sanitizeCurrencyInput(raw: string, maxIntDigits = 12): string {
  const dotIndex = raw.indexOf(".");
  if (dotIndex === -1) {
    return raw.replace(/\D/g, "").slice(0, maxIntDigits);
  }
  const intPart = raw.slice(0, dotIndex).replace(/\D/g, "").slice(0, maxIntDigits);
  const decPart = raw.slice(dotIndex + 1).replace(/\D/g, "").slice(0, 2);
  return `${intPart}.${decPart}`;
}

// Formats a currency string for display: commas in the integer part, the
// decimal part shown as-is (including a bare trailing "." while the user is
// still typing, and a leading "0" when the integer part is empty). Caps the
// decimal part at 2 digits defensively — normal typing already arrives here
// pre-sanitized via sanitizeCurrencyInput's onChange, but a value can also
// reach this function unsanitized (e.g. a dual-purpose %/$ field carrying
// over whatever was typed in the other mode), so this doesn't just trust
// its input is already clean.
export function formatCurrencyDisplay(value: string): string {
  if (!value) return "";
  const dotIndex = value.indexOf(".");
  if (dotIndex === -1) return formatWithCommas(value);
  const intPart = value.slice(0, dotIndex);
  const decPart = value.slice(dotIndex + 1, dotIndex + 3);
  return `${formatWithCommas(intPart) || "0"}.${decPart}`;
}

export function limitDigits(value: string, maxDigits: number): string {
  let result = "";
  let digitCount = 0;
  for (const ch of value) {
    if (/\d/.test(ch)) {
      if (digitCount >= maxDigits) continue;
      digitCount++;
    }
    result += ch;
  }
  return result;
}

// Trims every string in a JSON-shaped value, recursing into plain objects and
// arrays; leaves numbers, booleans, null and Dates untouched. Applied once per
// route, right after parsing the request body, so no caller has to remember
// to trim any individual field.
export function trimStrings<T>(value: T): T {
  if (typeof value === "string") return value.trim() as unknown as T;
  if (Array.isArray(value)) return value.map(trimStrings) as unknown as T;
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = trimStrings(v);
    return out as T;
  }
  return value;
}
