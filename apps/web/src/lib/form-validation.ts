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
