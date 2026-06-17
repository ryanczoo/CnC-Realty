type LeadRow = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  source: string;
  tags: { tag: { name: string } }[];
  priceMin: number | null;
  priceMax: number | null;
  timeframeToMove: string | null;
  agent: { user: { name: string | null } } | null;
  createdAt: Date;
  lastContactedAt: Date | null;
};

export function leadsToCSV(leads: LeadRow[]): string {
  const headers = [
    "First Name", "Last Name", "Email", "Phone", "Stage", "Source",
    "Tags", "Price Min", "Price Max", "Timeframe", "Assigned Agent",
    "Created Date", "Last Contacted",
  ];

  const escape = (val: string | null | undefined) => {
    if (val == null) return "";
    const s = String(val);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const rows = leads.map((l) => [
    escape(l.firstName),
    escape(l.lastName),
    escape(l.email),
    escape(l.phone),
    escape(l.status.replace(/_/g, " ")),
    escape(l.source),
    escape(l.tags.map((t) => t.tag.name).join("; ")),
    l.priceMin != null ? String(l.priceMin) : "",
    l.priceMax != null ? String(l.priceMax) : "",
    escape(l.timeframeToMove),
    escape(l.agent?.user?.name),
    l.createdAt.toLocaleDateString(),
    l.lastContactedAt ? l.lastContactedAt.toLocaleDateString() : "",
  ].join(","));

  return [headers.join(","), ...rows].join("\n");
}
