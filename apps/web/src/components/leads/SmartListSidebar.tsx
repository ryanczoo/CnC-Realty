"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { visiblePrebuiltLists } from "@/lib/smart-list-filters";
import { SmartListDrawer } from "./SmartListDrawer";
import { PHONE_TAB_BAR } from "@/lib/dashboard-phone";
import { confirmListDelete } from "@/lib/smart-list-delete";
import { pillScrollLeft } from "@/lib/pill-scroll";

type CustomList = { id: string; name: string; filters: unknown };

type Props = {
  customLists: CustomList[];
  isAdmin: boolean;
};

export function SmartListSidebar({ customLists: initialLists, isAdmin }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = searchParams.get("list");

  const [lists, setLists] = useState<CustomList[]>(initialLists);
  const rowRef = useRef<HTMLDivElement>(null);

  // Phones: the lists are a swipe row, so bring the open list's pill on screen (e.g. a new list lands at the end).
  // On desktop the column doesn't scroll sideways, so this does nothing there.
  useEffect(() => {
    const row = rowRef.current;
    const pill = row?.querySelector<HTMLElement>("[aria-current=\"true\"]");
    if (!row || !pill) return;
    const r = row.getBoundingClientRect();
    const p = pill.getBoundingClientRect();
    const next = pillScrollLeft({ left: r.left, width: r.width, scrollLeft: row.scrollLeft }, { left: p.left, width: p.width });
    if (next != null) row.scrollLeft = next;
  }, [selected, lists]);
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

  async function deleteList(id: string, name: string) {
    if (!confirmListDelete(name)) return;
    const res = await fetch(`/api/smart-lists/${id}`, { method: "DELETE" });
    if (!res.ok) return;
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
      <div ref={rowRef} className={`flex w-[200px] flex-shrink-0 flex-col border-r border-[#1B1B1B]/10 bg-white px-3 py-6 max-lg:w-full max-lg:flex-row max-lg:items-center max-lg:gap-1 max-lg:border-b max-lg:border-r-0 max-lg:px-4 max-lg:py-3 max-lg:[&_button]:w-auto max-lg:[&_button]:shrink-0 max-lg:[&_button]:whitespace-nowrap ${PHONE_TAB_BAR}`}>
        <button onClick={() => selectList(null)} className={linkClass(!selected)} aria-current={!selected || undefined}>
          Kanban
        </button>

        <div className="mt-4 max-lg:contents">
          <p className="mb-1 px-3 font-sans text-xs font-semibold uppercase tracking-wider text-[#1B1B1B]/30 max-lg:hidden">
            Smart Lists
          </p>
          {visiblePrebuiltLists(isAdmin).map(list => (
            <button
              key={list.slug}
              onClick={() => selectList(list.slug)}
              className={linkClass(selected === list.slug)}
              aria-current={selected === list.slug || undefined}
            >
              {list.name}
            </button>
          ))}
        </div>

        {lists.length > 0 && (
          <div className="mt-4 max-lg:contents">
            <p className="mb-1 px-3 font-sans text-xs font-semibold uppercase tracking-wider text-[#1B1B1B]/30 max-lg:hidden">
              My Lists
            </p>
            {lists.map(list => (
              <div key={list.id} className="group relative flex items-center max-lg:shrink-0">
                <button
                  onClick={() => selectList(list.id)}
                  className={`${linkClass(selected === list.id)} flex-1 truncate pr-14 max-lg:pr-1`}
                  aria-current={selected === list.id || undefined}
                >
                  {list.name}
                </button>
                <div className="absolute right-1 hidden gap-0.5 group-hover:flex max-lg:static max-lg:flex">
                  <button
                    onClick={() => openEdit(list)}
                    className="rounded p-1 font-sans text-xs text-[#1B1B1B]/30 hover:text-[#1B1B1B] max-lg:min-h-11 max-lg:min-w-11 max-lg:px-2.5 max-lg:py-1.5 max-lg:text-base max-lg:text-[#1B1B1B]/50"
                    title="Edit list"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => deleteList(list.id, list.name)}
                    className="rounded p-1 font-sans text-xs text-[#1B1B1B]/30 hover:text-[#1B1B1B] max-lg:min-h-11 max-lg:min-w-11 max-lg:px-2.5 max-lg:py-1.5 max-lg:text-base max-lg:text-[#1B1B1B]/50"
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
          className="mt-4 w-full rounded-lg border border-dashed border-[#1B1B1B]/20 px-3 py-1.5 text-left font-sans text-sm text-[#1B1B1B]/40 transition-colors hover:border-[#9E8C61]/40 hover:text-[#9E8C61] max-lg:mt-0"
        >
          + New List
        </button>
      </div>

      <SmartListDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSaved={(saved) => {
          setDrawerOpen(false);
          fetch("/api/smart-lists")
            .then(r => r.json())
            .then(data => {
              if (Array.isArray(data)) setLists(data);
            });
          // Navigate to the newly created/updated list
          selectList(saved.id);
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
