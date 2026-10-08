// Which step the wizard is on, clamped into the step list. The New Transaction wizard's
// referral flow reuses raw index 5 for Review on a 3-step list; clamping keeps it on "Review".
export function wizardStepIndex(steps: readonly string[], current: number): number {
  return Math.min(Math.max(current, 0), Math.max(steps.length - 1, 0));
}

// Compact phone step label, e.g. "Step 2 of 6 · Property".
export function wizardStepLabel(steps: readonly string[], current: number): string {
  if (steps.length === 0) return "";
  const i = wizardStepIndex(steps, current);
  return `Step ${i + 1} of ${steps.length} · ${steps[i]}`;
}
