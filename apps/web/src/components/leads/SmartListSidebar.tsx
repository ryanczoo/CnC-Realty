"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PREBUILT_LISTS } from "@/lib/smart-list-filters";
import SmartListDrawer from "./SmartListDrawer";

type CustomList = { id: string; name: string; filters: unknown };

type Props = {
  customLists: CustomList[];
};

export function SmartListSidebar({ customLists: initialLists }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = searchParams.get("list");

  const [lists, setLists] = useState<CustomList[]>(initialLists);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingList, setEditingList] = useState<CustomList | null>(null);

  function selectList(slug: string | null) {
    router.push(slug ? `/dashboard/leads?list=${slug}` : "/dashboard/leads");
  }

  function openCreate() {
    setEditingList(null);
    setDrawerOpen(true);
  }

  function openEdit(list: CustomList) {
    setEditingList(list);
    setDrawerOpen(true);
  }

  async function deleteList(id: string) {
    await fetch(`/api/smart-lists/${id}`, { method: "DELETE" });
    setLists(prev => prev.filter(l => l.id !== id));
    if (selected === id) selectList(null);
  }

  // Tags endpoint for the drawer: /api/tags (not /api/admin/tags)
  // Full SmartListDrawer implementation lives in Task 7.

  function linkClass(isSelected: boolean) {
    return `block w-full rounded-lg px-3 py-1.5 text-left font-sans text-sm transition-colors ${
      isSelected
        ? "bg-[#9E8C61]/10 font-medium text-[#9E8C61]"
        : "font-light text-[#1B1B1B]/60 hover:bg-[#F2F0EF] hover:text-[#1B1B1B]"
    }`;
  }

  return (
    <>
      <div className="flex w-[200px] flex-shrink-0 flex-col border-r border-[#1B1B1B]/10 bg-white px-3 py-6">
        <button onClick={() => selectList(null)} className={linkClass(!selected)}>
          Kanban
        </button>

        <div className="mt-4">
          <p className="mb-1 px-3 font-sans text-xs font-semibold uppercase tracking-wider text-[#1B1B1B]/30">
            Smart Lists
          </p>
          {PREBUILT_LISTS.map(list => (
            <button
              key={list.slug}
              onClick={() => selectList(list.slug)}
              className={linkClass(selected === list.slug)}
            >
              {list.name}
            </button>
          ))}
        </div>

        {lists.length > 0 && (
          <div className="mt-4">
            <p className="mb-1 px-3 font-sans text-xs font-semibold uppercase tracking-wider text-[#1B1B1B]/30">
              My Lists
            </p>
            {lists.map(list => (
              <div key={list.id} className="group relative flex items-center">
                <button
                  onClick={() => selectList(list.id)}
                  className={`${linkClass(selected === list.id)} flex-1 truncate pr-14`}
                >
                  {list.name}
                </button>
                <div className="absolute right-1 hidden gap-0.5 group-hover:flex">
                  <button
                    onClick={() => openEdit(list)}
                    className="rounded p-1 font-sans text-xs text-[#1B1B1B]/30 hover:text-[#1B1B1B]"
                    title="Edit list"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => deleteList(list.id)}
                    className="rounded p-1 font-sans text-xs text-[#1B1B1B]/30 hover:text-[#1B1B1B]"
                    title="Delete list"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={openCreate}
          className="mt-4 w-full rounded-lg border border-dashed border-[#1B1B1B]/20 px-3 py-1.5 text-left font-sans text-sm text-[#1B1B1B]/40 transition-colors hover:border-[#9E8C61]/40 hover:text-[#9E8C61]"
        >
          + New List
        </button>
      </div>

      <SmartListDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={() => {
          setDrawerOpen(false);
          // Refresh custom lists after save
          fetch("/api/smart-lists")
            .then(r => r.json())
            .then(data => { if (Array.isArray(data)) setLists(data); });
        }}
        initial={
          editingList
            ? {
                id: editingList.id,
                name: editingList.name,
                filters: editingList.filters as import("@/lib/smart-list-filters").FilterCondition[],
              }
            : undefined
        }
      />
    </>
  );
}
