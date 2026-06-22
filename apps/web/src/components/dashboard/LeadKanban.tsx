"use client";
import { useState, type ReactNode } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { LeadCard } from "./LeadCard";
import { NewLeadModal, type SavedLead } from "@/components/leads/NewLeadModal";
import { motion } from "framer-motion";
import { PULSE_ANIMATE, PULSE_TRANSITION, SPRING_HOVER } from "@/lib/motion";

type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "SHOWING" | "OFFER" | "UNDER_CONTRACT" | "CLOSED" | "LOST";

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  status: LeadStatus;
  createdAt: string;
}

const COLUMNS: { status: LeadStatus; label: string }[] = [
  { status: "NEW", label: "New" },
  { status: "CONTACTED", label: "Contacted" },
  { status: "QUALIFIED", label: "Qualified" },
  { status: "SHOWING", label: "Showing" },
  { status: "OFFER", label: "Offer" },
  { status: "UNDER_CONTRACT", label: "Under Contract" },
  { status: "CLOSED", label: "Closed" },
  { status: "LOST", label: "Lost" },
];

function DroppableColumn({ status, children }: { status: string; children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className="flex min-h-[120px] flex-col gap-2 rounded-2xl bg-[#1B1B1B]/5 p-2">
      {children}
    </div>
  );
}

export function LeadKanban({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  function handleLeadSaved(lead: SavedLead) {
    setLeads((prev) => [{ ...lead, status: "NEW" as LeadStatus }, ...prev]);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    // over.id is the column status for empty columns, or a lead id when dropped onto a card
    let newStatus = over.id as LeadStatus;
    if (!COLUMNS.find((c) => c.status === newStatus)) {
      const overLead = leads.find((l) => l.id === over.id);
      if (!overLead) return;
      newStatus = overLead.status;
    }

    const activeLead = leads.find((l) => l.id === active.id);
    if (!activeLead || activeLead.status === newStatus) return;

    setLeads((prev) => prev.map((l) => l.id === active.id ? { ...l, status: newStatus } : l));

    await fetch(`/api/leads/${active.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  }

  const activeLead = leads.find((l) => l.id === activeId);

  return (
    <>
      <div className="mb-4 flex justify-end">
        <motion.button
          onClick={() => setShowModal(true)}
          className="rounded-full bg-[#1B1B1B] px-5 py-2 text-sm text-white"
          animate={PULSE_ANIMATE}
          transition={PULSE_TRANSITION}
          whileHover={{ scale: 1.05, transition: SPRING_HOVER }}
        >
          + Add Lead
        </motion.button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e) => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(({ status, label }) => {
            const col = leads.filter((l) => l.status === status);
            return (
              <div key={status} className="flex w-56 flex-shrink-0 flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="font-sans text-xs font-medium uppercase tracking-widest text-[#1B1B1B]/50">{label}</p>
                  <span className="rounded-full bg-[#1B1B1B]/10 px-2 py-0.5 font-sans text-xs text-[#1B1B1B]/50">{col.length}</span>
                </div>
                <SortableContext id={status} items={col.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                  <DroppableColumn status={status}>
                    {col.map((lead) => <LeadCard key={lead.id} lead={lead} />)}
                  </DroppableColumn>
                </SortableContext>
              </div>
            );
          })}
        </div>
        <DragOverlay>
          {activeLead && <LeadCard lead={activeLead} />}
        </DragOverlay>
      </DndContext>
      <NewLeadModal open={showModal} onClose={() => setShowModal(false)} onSaved={handleLeadSaved} />
    </>
  );
}
