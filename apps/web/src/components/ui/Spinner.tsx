import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// The gold loading spinner used across the app (six pages already inline the
// same icon). Pass className to change size or color, e.g. text-white on gold.
export function Spinner({ className }: { className?: string }) {
  return <Loader2 aria-hidden="true" className={cn("h-4 w-4 animate-spin text-[#9E8C61]", className)} />;
}
