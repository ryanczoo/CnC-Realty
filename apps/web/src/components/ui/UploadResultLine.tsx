import { CheckIcon } from "@/components/ui/CheckIcon";
import { XIcon } from "@/components/ui/XIcon";

export type UploadResult = { name: string; ok: true } | { name: string; ok: false; error: string };

// Shared "did my upload work?" line — the wizard photo block (label "Photo
// uploaded", centered) and the Checklist tab's rows and Additional Documents
// (the file name, left-aligned). ✓ in gold on success; ✗ plus the server's
// reason in red on failure.
export function UploadResultLine({
  label,
  result,
  align = "left",
}: {
  label?: string;
  result: UploadResult | null;
  align?: "left" | "center";
}) {
  if (!result) return null;
  const line = result.ok ? (
    <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-[#9E8C61]">
      {label ?? result.name} <CheckIcon size={14} />
    </p>
  ) : (
    <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-red-600">
      {label ?? result.name} <XIcon size={14} /> {result.error}
    </p>
  );
  return align === "center" ? <div className="text-center">{line}</div> : line;
}
