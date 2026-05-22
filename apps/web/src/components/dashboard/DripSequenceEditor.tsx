"use client";

export type DripStepData = {
  stepOrder: number;
  delayDays: number;
  subject: string;
  body: string;
};

type Props = {
  steps: DripStepData[];
  onChange: (steps: DripStepData[]) => void;
};

export function DripSequenceEditor({ steps, onChange }: Props) {
  const addStep = () => {
    onChange([
      ...steps,
      {
        stepOrder: steps.length + 1,
        delayDays: steps.length === 0 ? 0 : 3,
        subject: "",
        body: "",
      },
    ]);
  };

  const removeStep = (index: number) => {
    onChange(
      steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, stepOrder: i + 1 }))
    );
  };

  const updateStep = (index: number, field: keyof DripStepData, value: string | number) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div className="flex flex-col gap-4">
      {steps.length === 0 && (
        <p className="rounded-xl border border-dashed border-[#1B1B1B]/10 py-8 text-center font-sans text-sm text-[#1B1B1B]/40">
          No steps yet — add your first email below.
        </p>
      )}

      {steps.map((step, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl border border-[#1B1B1B]/10 p-4">
          <div className="flex items-center justify-between">
            <span className="font-sans text-sm font-medium text-[#1B1B1B]">Step {i + 1}</span>
            {steps.length > 1 && (
              <button
                type="button"
                onClick={() => removeStep(i)}
                className="font-sans text-xs text-red-400 transition-colors hover:text-red-600"
              >
                Remove
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap font-sans text-xs text-[#1B1B1B]/60">Send after</span>
            <input
              type="number"
              min={0}
              value={step.delayDays}
              onChange={(e) => updateStep(i, "delayDays", parseInt(e.target.value, 10) || 0)}
              className="w-16 rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-3 py-1.5 text-center font-sans text-sm text-[#1B1B1B] outline-none"
            />
            <span className="font-sans text-xs text-[#1B1B1B]/60">day(s)</span>
          </div>

          <input
            type="text"
            placeholder="Subject line…"
            value={step.subject}
            onChange={(e) => updateStep(i, "subject", e.target.value)}
            className="rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-2.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] placeholder:text-[#1B1B1B]/30"
          />

          <textarea
            placeholder="Email body…"
            value={step.body}
            onChange={(e) => updateStep(i, "body", e.target.value)}
            rows={4}
            className="resize-none rounded-lg border border-[#1B1B1B]/10 bg-[#F2F0EF] px-4 py-2.5 font-sans text-sm text-[#1B1B1B] outline-none focus:border-[#9E8C61] placeholder:text-[#1B1B1B]/30"
          />
        </div>
      ))}

      <button
        type="button"
        onClick={addStep}
        className="rounded-full border border-dashed border-[#1B1B1B]/20 px-4 py-2.5 font-sans text-sm text-[#1B1B1B]/50 transition-colors hover:border-[#9E8C61] hover:text-[#9E8C61]"
      >
        + Add Step
      </button>
    </div>
  );
}
