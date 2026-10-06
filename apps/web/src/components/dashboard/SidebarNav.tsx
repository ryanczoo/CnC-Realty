import Link from "next/link";
import { AGENT_NAV, ACADEMY_NAV, ADMIN_NAV, SETTINGS_ITEM, type NavItem } from "@/lib/dashboard-nav";

function NavSection({
  label,
  items,
  stickToBottom = false,
  preserveCase = false,
  activeHref,
}: {
  label: string;
  items: NavItem[];
  stickToBottom?: boolean;
  preserveCase?: boolean;
  activeHref?: string;
}) {
  return (
    <div className={stickToBottom ? "mt-auto" : "mb-6"}>
      <p
        className={`mb-1 px-3 text-xs font-semibold tracking-wider text-[#1B1B1B]/30 ${preserveCase ? "" : "uppercase"}`}
      >
        {label}
      </p>
      <div className="mb-2 border-t border-[#1B1B1B]/10" />
      <nav className="flex flex-col gap-1">
        {items.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`rounded-lg px-3 py-2 font-sans text-sm font-light text-[#1B1B1B]/60 transition-colors hover:bg-[#F2F0EF] hover:text-[#1B1B1B]${href === activeHref ? " bg-[#F2F0EF] !text-[#1B1B1B]" : ""}`}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

// The dashboard sidebar's contents — rendered by the desktop sidebar (no activeHref) and the
// phone menu (DashboardMobileNav, with activeHref).
export function SidebarNav({ isAdmin, email, activeHref }: { isAdmin: boolean; email: string; activeHref?: string }) {
  return (
    <>
      <NavSection label="Agent" items={AGENT_NAV} activeHref={activeHref} />
      <NavSection label="CnC ACADEMY" items={ACADEMY_NAV} preserveCase activeHref={activeHref} />
      {!isAdmin && <NavSection label="Account" items={[SETTINGS_ITEM]} stickToBottom activeHref={activeHref} />}
      {isAdmin && <NavSection label="Admin" items={[...ADMIN_NAV, SETTINGS_ITEM]} stickToBottom activeHref={activeHref} />}

      <div className="border-t border-[#1B1B1B]/10 pt-4">
        <p className="font-sans text-xs text-[#1B1B1B]/40">{email}</p>
        {isAdmin && (
          <p className="mt-0.5 font-sans text-xs font-medium text-[#9E8C61]">Admin</p>
        )}
      </div>
    </>
  );
}
