"use client";
import { Upload } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";

// Shared upload-button UI — a label wrapping a hidden file input, matching
// the exact pill styling ChecklistPanel has always used. "solid" is the
// dark filled pill used for a specific checklist item's Upload button;
// "outline" is the lighter bordered pill used for an unattached/Additional
// Documents upload.
export function UploadFileButton({
  label,
  uploading,
  disabled = false,
  variant = "solid",
  onSelect,
}: {
  label: string;
  uploading: boolean;
  disabled?: boolean;
  variant?: "solid" | "outline";
  onSelect: (file: File) => void;
}) {
  const variantClass = variant === "solid"
    ? `shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${uploading ? "bg-zinc-100 text-zinc-400" : "bg-[#1B1B1B] text-white hover:bg-[#1B1B1B]/80"}`
    : `rounded-full border border-[#1B1B1B]/20 px-3 py-1.5 text-xs font-medium text-[#1B1B1B]/60 hover:border-[#1B1B1B]/40 hover:text-[#1B1B1B] ${uploading ? "opacity-50" : ""}`;

  return (
    <label className={`${disabled ? "pointer-events-none opacity-40 " : ""}cursor-pointer ${variantClass}`}>
      {uploading ? <><Spinner className="mr-1 inline h-3 w-3" />Uploading…</> : <><Upload className="mr-1 inline h-3 w-3" />{label}</>}
      <input
        type="file"
        className="sr-only"
        accept=".pdf,.jpg,.jpeg,.png,.docx"
        disabled={uploading || disabled}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onSelect(f); }}
      />
    </label>
  );
}
