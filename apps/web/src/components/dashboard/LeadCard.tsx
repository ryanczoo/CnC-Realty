import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  createdAt: string;
}

export function LeadCard({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      {...attributes}
      {...listeners}
      className="cursor-grab rounded-xl bg-white p-4 shadow-sm active:cursor-grabbing"
    >
      <p className="font-sans text-sm font-medium text-[#1B1B1B]">
        {lead.firstName} {lead.lastName}
      </p>
      <p className="mt-0.5 font-sans text-xs text-[#1B1B1B]/50">{lead.email}</p>
      <Link
        href={`/dashboard/leads/${lead.id}`}
        onClick={(e) => e.stopPropagation()}
        className="mt-3 inline-block font-sans text-xs text-[#9E8C61] hover:underline"
      >
        View →
      </Link>
    </div>
  );
}
