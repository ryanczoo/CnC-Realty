"use client";
import { useState } from "react";

// Shared document-upload mechanism — request a presigned R2 URL, PUT the
// file, then register it as a FileDocument. Used by both the agent-side
// ChecklistPanel and the admin-side checklist review view, so an admin
// (e.g. acting as a paid transaction coordinator) has the exact same
// ability to upload as the file's own agent. itemId is null for an
// "Additional Documents" upload not tied to a specific checklist item —
// mirrors ChecklistPanel's own "additional" convention for the in-flight
// upload id.
export function useFileUpload(fileType: "LISTING" | "TRANSACTION", fileId: string, onUploaded: () => void) {
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(itemId: string | null, file: File) {
    setUploadingId(itemId ?? "additional");
    setError(null);

    try {
      const params = new URLSearchParams({
        fileType: fileType === "LISTING" ? "listing" : "transaction",
        fileId,
        filename: file.name,
        contentType: file.type,
        size: String(file.size),
      });
      const { uploadUrl, key, documentId } = await fetch(`/api/upload-url?${params}`).then((r) => r.json());

      const uploadRes = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!uploadRes.ok) throw new Error("Upload failed");

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileType, fileId, checklistItemId: itemId, name: file.name, r2Key: key, r2Url: key, documentId }),
      });
      if (!res.ok) throw new Error("Upload failed");

      onUploaded();
    } catch {
      setError("Couldn't upload that file. Please try again.");
    } finally {
      setUploadingId(null);
    }
  }

  return { uploadingId, error, upload };
}
