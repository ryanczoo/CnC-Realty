"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";

export function BackLink() {
  const [href, setHref] = useState("/properties");

  useEffect(() => {
    const saved = sessionStorage.getItem("searchUrl");
    if (saved) setHref(saved);
  }, []);

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-sm text-white transition-colors hover:text-white/70"
    >
      <ChevronLeft className="h-4 w-4" />
      Back to search
    </Link>
  );
}
