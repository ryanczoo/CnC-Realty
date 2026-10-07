"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";
import { SidebarNav } from "@/components/dashboard/SidebarNav";
import { dashboardNavMatch, dashboardPageTitle } from "@/lib/dashboard-nav";
import { useIsMobile } from "@/hooks/useIsMobile";
import { EASE_OUT_EXPO } from "@/lib/motion";

// Phones only (<1024px): slim bar with the menu button and page name; the sidebar slides in
// from the left over the page. Same backdrop/AnimatePresence pattern as the site navbar's menu.
export function DashboardMobileNav({ email, isAdmin }: { email: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  // Close on navigation, and whenever the window grows to desktop width.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!isMobile) setOpen(false);
  }, [isMobile]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="flex h-11 flex-shrink-0 items-center gap-2 border-b border-[#1B1B1B]/10 bg-white px-2 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open dashboard menu"
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[#1B1B1B]/70 transition-colors hover:bg-[#F2F0EF]"
        >
          <Menu size={20} />
        </button>
        <p className="truncate font-sans text-sm font-medium text-[#1B1B1B]">{dashboardPageTitle(pathname, isAdmin)}</p>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="dashboard-menu-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60] bg-black/40 lg:hidden"
              onClick={() => setOpen(false)}
            />
            <motion.aside
              key="dashboard-menu-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Dashboard menu"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.3, ease: EASE_OUT_EXPO as [number, number, number, number] }}
              className="fixed inset-y-0 left-0 z-[70] flex w-[280px] max-w-[85vw] flex-col overflow-y-auto bg-white px-4 py-4 shadow-2xl lg:hidden"
              onClick={(e) => {
                // Close on any link tap, including the current page's link (pathname won't change then).
                if ((e.target as HTMLElement).closest("a")) setOpen(false);
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close dashboard menu"
                className="mb-4 flex h-9 w-9 items-center justify-center self-end rounded-lg text-[#1B1B1B]/60 transition-colors hover:bg-[#F2F0EF]"
              >
                <X size={18} />
              </button>
              <SidebarNav isAdmin={isAdmin} email={email} activeHref={dashboardNavMatch(pathname, isAdmin)?.href} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
