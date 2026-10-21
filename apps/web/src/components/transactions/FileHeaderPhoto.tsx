"use client";
import { useState } from "react";
import { PhotoLightbox } from "@/components/ui/PhotoLightbox";

interface Props {
  fileType: "listing" | "transaction";
  fileId: string;
  photoKey: string | null;
  address: string;
}

// The property photo beside the address in a file page's header (agent and
// admin). As tall as the two address lines; clicking opens the full-size view
// on the same page. Nothing at all when the file has no photo.
export function FileHeaderPhoto({ fileType, fileId, photoKey, address }: Props) {
  const [open, setOpen] = useState(false);
  if (!photoKey) return null;
  const src = `/api/files/${fileType}/${fileId}/photo`;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="View full-size photo" className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={address} className="h-14 w-[84px] rounded-lg object-cover" />
      </button>
      {open && (
        <PhotoLightbox photos={[src]} index={0} alt={() => address} onIndexChange={() => {}} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

// Puts the header photo to the right of the address lines (children). With no
// photo it renders the children alone, so headers without one are unchanged.
export function WithHeaderPhoto({ children, ...photo }: Props & { children: React.ReactNode }) {
  if (!photo.photoKey) return <>{children}</>;
  return (
    <div className="flex items-start gap-4">
      <div>{children}</div>
      <FileHeaderPhoto {...photo} />
    </div>
  );
}
