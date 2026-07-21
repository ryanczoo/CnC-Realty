"use client";

import { useState } from "react";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { AddNoteForm } from "@/components/dashboard/AddNoteForm";
import { LeadTasksTab } from "./LeadTasksTab";
import { HomesTab } from "./HomesTab";
import { LeadActionPlansSection } from "./LeadActionPlansSection";

type Tab = "activity" | "tasks" | "homes" | "plans";

interface ActivityItem {
  id: string;
  type: string;
  content: string;
  createdAt: string;
}

interface TaskItem {
  id: string;
  title: string;
  taskType: string;
  dueDate: string | null;
  notes: string | null;
  done: boolean;
  completedAt: string | null;
}

interface Props {
  leadId: string;
  activities: ActivityItem[];
  tasks: TaskItem[];
}

export function LeadProfileTabs({ leadId, activities, tasks }: Props) {
  const [tab, setTab] = useState<Tab>("activity");

  const tabs: { id: Tab; label: string }[] = [
    { id: "activity", label: "Activity" },
    { id: "tasks", label: "Tasks" },
    { id: "homes", label: "Homes" },
    { id: "plans", label: "Action Plans" },
  ];

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-xl bg-[#F2F0EF] p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              tab === t.id ? "bg-white text-[#1B1B1B] shadow-sm" : "text-[#1B1B1B]/50 hover:text-[#1B1B1B]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl bg-white p-6">
        {tab === "activity" && (
          <div className="space-y-6">
            <AddNoteForm leadId={leadId} />
            <ActivityFeed activities={activities} />
          </div>
        )}
        {tab === "tasks" && <LeadTasksTab leadId={leadId} initialTasks={tasks} />}
        {tab === "homes" && <HomesTab leadId={leadId} />}
        {tab === "plans" && <LeadActionPlansSection leadId={leadId} />}
      </div>
    </div>
  );
}
