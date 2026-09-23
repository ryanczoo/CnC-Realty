export function formatPhoneInput(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function stripDigits(value: string): string {
  return value.replace(/\d/g, "");
}

export function digitsOnly(value: string, maxLength: number): string {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

// Inserts thousands-separator commas into a plain digit string, e.g.
// "800000" -> "800,000". Whole-digit-only by design (no decimals) — matches
// the pattern already used for Volume Closed on the agent Settings page.
export function formatWithCommas(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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
