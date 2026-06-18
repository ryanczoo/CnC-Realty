"use client";

import { useRouter } from "next/navigation";
import { LeadDetailSidebar } from "./LeadDetailSidebar";

type Props = {
  lead: React.ComponentProps<typeof LeadDetailSidebar>["lead"];
};

export function LeadDetailSidebarWrapper({ lead }: Props) {
  const router = useRouter();
  return <LeadDetailSidebar lead={lead} onRefresh={() => router.refresh()} />;
}
