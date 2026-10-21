// Browser side of a wizard photo upload: ask for an upload URL, PUT the raw
// photo straight to R2, then have the server shrink it. Never throws.
async function reasonFrom(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : "Upload failed";
}

export async function uploadWizardPhoto(
  file: File,
): Promise<{ ok: true; photoKey: string } | { ok: false; error: string }> {
  try {
    const params = new URLSearchParams({ filename: file.name, contentType: file.type, size: String(file.size) });
    const urlRes = await fetch(`/api/wizard-photo/upload-url?${params}`);
    if (!urlRes.ok) return { ok: false, error: await reasonFrom(urlRes) };
    const { uploadUrl, key } = await urlRes.json();

    const put = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
    if (!put.ok) return { ok: false, error: "Upload failed" };

    const res = await fetch("/api/wizard-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    if (!res.ok) return { ok: false, error: await reasonFrom(res) };
    const { photoKey } = await res.json();
    return { ok: true, photoKey };
  } catch {
    return { ok: false, error: "Upload failed" };
  }
}
