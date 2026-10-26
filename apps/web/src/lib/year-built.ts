// Year Built rules shared by both wizards, the Overview pencils, the create/edit
// routes and the Pending/Convert gates. Land may have no building, so it's the
// one property type that doesn't need a year.

export const YEAR_BUILT_MIN = 1500;

// New construction can be listed before it's finished, so next year is allowed.
export function maxYearBuilt(now: Date = new Date()): number {
  return now.getFullYear() + 1;
}

export function needsYearBuilt(propertyType: string | null | undefined): boolean {
  return propertyType !== "Land";
}

const isBlank = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

function rangeError(value: unknown, label: string, now: Date): string | null {
  const s = String(value).trim();
  const n = Number(s);
  const max = maxYearBuilt(now);
  return /^\d{4}$/.test(s) && n >= YEAR_BUILT_MIN && n <= max ? null : `${label} must be between ${YEAR_BUILT_MIN} and ${max}`;
}

export function yearBuiltError(value: unknown, propertyType: string | null | undefined, now: Date = new Date()): string | null {
  if (isBlank(value)) return needsYearBuilt(propertyType) ? "Year Built is required" : null;
  return rangeError(value, "Year Built", now);
}

// The admin Checklists setting: blank means the item goes on every file.
export function builtBeforeError(value: unknown, now: Date = new Date()): string | null {
  return isBlank(value) ? null : rangeError(value, "Built before", now);
}

// What a file still needs before it can go Pending or be converted.
export function missingPropertyFacts(f: { propertyType?: string | null; yearBuilt?: number | null }): ("property type" | "year built")[] {
  const missing: ("property type" | "year built")[] = [];
  if (isBlank(f.propertyType)) missing.push("property type");
  if (f.yearBuilt == null && needsYearBuilt(f.propertyType ?? null)) missing.push("year built");
  return missing;
}
