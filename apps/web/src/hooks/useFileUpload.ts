"use client";
import { useState } from "react";
import type { UploadResult } from "@/components/ui/UploadResultLine";

// The server's own reason (e.g. "File exceeds 50MB limit") when it gave one.
async function reasonFrom(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : "Upload failed";
}

// Shared document-upload mechanism — request a presigned R2 URL, PUT the
// file, then register it as a FileDocument. itemId is null for an
// "Additional Documents" upload not tied to a specific checklist item;
// replacesDocumentId is the rejected additional document it takes the place of.
// Never throws: the result says what happened, for UploadResultLine.
export async function uploadDocument(
  fileType: "LISTING" | "TRANSACTION",
  fileId: string,
  itemId: string | null,
  file: File,
  replacesDocumentId?: string,
): Promise<UploadResult> {
  const name = file.name;
  try {
    const params = new URLSearchParams({
      fileType: fileType === "LISTING" ? "listing" : "transaction",
      fileId,
      filename: file.name,
      contentType: file.type,
      size: String(file.size),
    });
    const urlRes = await fetch(`/api/upload-url?${params}`);
    if (!urlRes.ok) return { name, ok: false, error: await reasonFrom(urlRes) };
    const { uploadUrl, key, documentId } = await urlRes.json();

    const uploadRes = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
    if (!uploadRes.ok) return { name, ok: false, error: "Upload failed" };

    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileType, fileId, checklistItemId: itemId, name: file.name, r2Key: key, r2Url: key, documentId, ...(replacesDocumentId && { replacesDocumentId }) }),
    });
    if (!res.ok) return { name, ok: false, error: await reasonFrom(res) };
    return { name, ok: true };
  } catch {
    return { name, ok: false, error: "Upload failed" };
  }
}

// Used by both the agent-side ChecklistPanel and the admin-side checklist
// view, so an admin (e.g. acting as a paid transaction coordinator) has the
// exact same ability to upload as the file's own agent. results is keyed by
// checklist item id, or "additional" for the Additional Documents uploads
// (a rejected line's replacement too — its old line goes away). uploadingId
// for a replacement is "replace:<id>", so only that line's button spins.
export function useFileUpload(fileType: "LISTING" | "TRANSACTION", fileId: string, onUploaded: () => void) {
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, UploadResult>>({});

  async function upload(itemId: string | null, file: File, replacesDocumentId?: string) {
    const target = itemId ?? "additional";
    setUploadingId(replacesDocumentId ? `replace:${replacesDocumentId}` : target);
    const result = await uploadDocument(fileType, fileId, itemId, file, replacesDocumentId);
    setResults((r) => ({ ...r, [target]: result }));
    setUploadingId(null);
    if (result.ok) onUploaded();
  }

  return { uploadingId, results, upload };
}
