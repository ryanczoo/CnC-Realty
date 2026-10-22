"use client";
import { useState } from "react";
import { UploadResultLine, type UploadResult } from "@/components/ui/UploadResultLine";
import { uploadWizardPhoto } from "@/lib/wizard-photo-client";

// Shared "Property Photo" block for the New Listing and New Transaction
// wizards: centered label, black pill button (no pulse — Ryan, 2026-10-21),
// then "Photo uploaded" with ✓, or ✗ and the server's reason. A failed upload
// keeps any photo already chosen.
export function PhotoUploadField({ photoKey, onChange }: { photoKey: string; onChange: (key: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const res = await uploadWizardPhoto(file, photoKey || undefined);
    if (res.ok) {
      onChange(res.photoKey);
      setResult({ name: file.name, ok: true });
    } else {
      setResult({ name: file.name, ok: false, error: res.error });
    }
    setUploading(false);
    e.target.value = "";
  }

  // Coming back to this step after a successful upload still shows the ✓.
  const shown = result ?? (photoKey ? { name: "", ok: true as const } : null);

  return (
    <div className="text-center">
      <label className="mb-1.5 block text-xs font-medium text-[#1B1B1B]/50">Property Photo</label>
      <label
        className={`inline-flex cursor-pointer items-center rounded-full px-4 py-2 text-xs font-medium transition-colors ${
          uploading ? "bg-zinc-100 text-zinc-400" : "bg-[#1B1B1B] text-white hover:bg-[#1B1B1B]/80"
        }`}
      >
        {uploading ? "Uploading…" : photoKey ? "Replace Photo" : "Upload Photo"}
        <input
          type="file"
          accept="image/jpeg,image/png"
          className="sr-only"
          disabled={uploading}
          onChange={handleChange}
        />
      </label>
      {/* align="center" wraps it in its own block, so it sits under the button, not beside it. */}
      {!uploading && <UploadResultLine label="Photo uploaded" result={shown} align="center" />}
    </div>
  );
}
