import { wizardStepIndex, wizardStepLabel } from "@/lib/wizard-steps";

// Step bar shared by the New Transaction and New Listing wizards. Desktop: the full
// labelled bar (unchanged markup). Phones (<1024px): dots + "Step 2 of 6 · Property".
export function WizardStepBar({ steps, current }: { steps: readonly string[]; current: number }) {
  const phoneIndex = wizardStepIndex(steps, current);
  return (
    <>
      <div className="mb-20 mx-auto flex max-w-5xl items-center max-lg:hidden">
        {steps.flatMap((s, i) => {
          const done = i < current;
          const active = i === current;
          const el = (
            <div key={s} className="flex shrink-0 items-center gap-2.5 whitespace-nowrap">
              {active && <div className="h-3 w-3 rounded-full bg-[#1B1B1B]" />}
              {done && <div className="h-3 w-3 rounded-full bg-[#9E8C61]" />}
              <span
                className={`text-base ${active ? "font-semibold text-[#1B1B1B]" : done ? "text-[#9E8C61]" : "text-[#1B1B1B]/30"}`}
              >
                {s}
              </span>
            </div>
          );
          if (i < steps.length - 1)
            return [el, <div key={`ln-${i}`} className="mx-3 h-px flex-1 bg-[#1B1B1B]/10" />];
          return [el];
        })}
      </div>
      <div className="mb-8 lg:hidden">
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`h-2.5 w-2.5 rounded-full ${i < phoneIndex ? "bg-[#9E8C61]" : i === phoneIndex ? "bg-[#1B1B1B]" : "bg-[#1B1B1B]/15"}`}
            />
          ))}
        </div>
        <p className="mt-3 text-sm font-semibold text-[#1B1B1B]">{wizardStepLabel(steps, current)}</p>
      </div>
    </>
  );
}
