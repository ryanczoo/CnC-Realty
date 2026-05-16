interface Activity {
  id: string;
  type: string;
  content: string;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  NOTE: "Note",
  CALL: "Call",
  EMAIL: "Email",
  SHOWING: "Showing",
  OFFER: "Offer",
  DOCUMENT: "Document",
};

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) {
    return <p className="font-sans text-sm text-[#1B1B1B]/40">No activity yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {activities.map((a) => (
        <div key={a.id} className="flex gap-3">
          <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-[#9E8C61]" />
          <div>
            <p className="font-sans text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/40">
              {TYPE_LABELS[a.type] ?? a.type} · {new Date(a.createdAt).toLocaleDateString()}
            </p>
            <p className="mt-0.5 font-sans text-sm text-[#1B1B1B]">{a.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
