// Which checklist template items go on a file, given its Year Built. An item
// with builtBefore N applies only when the year is known and earlier than N;
// items without one apply to every file, as before. File rows are matched to
// template items by name (rows keep no link to the template).

export type TemplateItemLike = { name: string; description: string | null; order: number; isRequired: boolean; builtBefore: number | null };
export type FileRowLike = { id: string; name: string; isRequired: boolean; documentCount: number };

export function builtBeforeApplies(builtBefore: number | null | undefined, yearBuilt: number | null | undefined): boolean {
  if (builtBefore == null) return true;
  return yearBuilt != null && yearBuilt < builtBefore;
}

// The FileChecklistItem rows to create for a new file.
export function checklistCreateData(fileType: "LISTING" | "TRANSACTION", items: TemplateItemLike[], yearBuilt: number | null | undefined) {
  return items
    .filter((i) => builtBeforeApplies(i.builtBefore, yearBuilt))
    .map((i) => ({ fileType, name: i.name, description: i.description, order: i.order, isRequired: i.isRequired, builtBefore: i.builtBefore ?? null }));
}

// What a year change does to an existing checklist: only year-based items move,
// and a row with any document attached is never changed or removed.
export function planYearChecklistChange(templateItems: TemplateItemLike[], rows: FileRowLike[], yearBuilt: number | null | undefined) {
  const add: TemplateItemLike[] = [];
  const removeIds: string[] = [];
  const requiredUpdates: { id: string; isRequired: boolean; builtBefore: number }[] = [];
  for (const item of templateItems) {
    if (item.builtBefore == null) continue;
    const matches = rows.filter((r) => r.name === item.name);
    if (builtBeforeApplies(item.builtBefore, yearBuilt)) {
      if (matches.length === 0) add.push(item);
      for (const r of matches) {
        if (r.documentCount === 0 && r.isRequired !== item.isRequired) {
          requiredUpdates.push({ id: r.id, isRequired: item.isRequired, builtBefore: item.builtBefore });
        }
      }
    } else {
      for (const r of matches) if (r.documentCount === 0) removeIds.push(r.id);
    }
  }
  return { add, removeIds, requiredUpdates };
}

// "LPD — Lead-Based…" → "LPD"; "Report (Homeowner's…)" → "Report" — for the Activity line.
export function shortItemName(name: string): string {
  return name.split(" — ")[0].split(" (")[0].trim();
}
