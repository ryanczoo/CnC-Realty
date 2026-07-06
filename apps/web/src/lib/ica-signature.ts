function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function namesMatch(signatureName: string, firstName: string, lastName: string): boolean {
  return normalize(signatureName) === normalize(`${firstName} ${lastName}`);
}
