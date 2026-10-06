export type NavItem = { href: string; label: string };

export const AGENT_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/leads", label: "Leads" },
  { href: "/dashboard/pipeline", label: "Pipeline" },
  { href: "/dashboard/tasks", label: "Tasks" },
  { href: "/dashboard/transactions", label: "Transactions" },
  { href: "/dashboard/campaigns", label: "Campaigns" },
];

export const SETTINGS_ITEM: NavItem = { href: "/dashboard/settings", label: "Settings" };

export const ACADEMY_NAV: NavItem[] = [
  { href: "/dashboard/academy/videos", label: "Training Videos" },
  { href: "/dashboard/academy/guides", label: "Documents" },
  { href: "/dashboard/academy/announcements", label: "Announcements" },
];

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/agents", label: "All Agents" },
  { href: "/admin/leads", label: "All Leads" },
  { href: "/admin/transactions", label: "All Files" },
  { href: "/admin/applications", label: "Applications" },
  { href: "/admin/action-plans", label: "Action Plans" },
  { href: "/admin/settings/checklists", label: "Checklists" },
  { href: "/admin/blog", label: "Blog" },
  { href: "/admin/settings/tags", label: "Tags" },
];

// Slim-bar names for admin pages the nav doesn't list (and to tell the two "Overview"s apart).
const EXTRA_TITLES: NavItem[] = [
  { href: "/admin", label: "Admin Overview" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/triggers", label: "Triggers" },
];

const covers = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

function longestMatch(pathname: string, items: NavItem[]): NavItem | null {
  return items.filter((i) => covers(pathname, i.href)).sort((a, b) => b.href.length - a.href.length)[0] ?? null;
}

function navItems(isAdmin: boolean): NavItem[] {
  return [...AGENT_NAV, ...ACADEMY_NAV, SETTINGS_ITEM, ...(isAdmin ? ADMIN_NAV : [])];
}

// The sidebar link to highlight for this page.
export function dashboardNavMatch(pathname: string, isAdmin: boolean): NavItem | null {
  return longestMatch(pathname, navItems(isAdmin));
}

// The page name shown in the phone slim bar. Extras come first so they win ties.
export function dashboardPageTitle(pathname: string, isAdmin: boolean): string {
  const items = [...(isAdmin ? EXTRA_TITLES : []), ...navItems(isAdmin)];
  return longestMatch(pathname, items)?.label ?? "Dashboard";
}
