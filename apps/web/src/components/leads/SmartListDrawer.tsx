// Stub — full implementation in Task 7
export function SmartListDrawer(_props: {
  open: boolean;
  onClose: () => void;
  initial?: { id: string; name: string; filters: import("@/lib/smart-list-filters").FilterCondition[] };
  onSaved: (list: { id: string; name: string; filters: unknown }) => void;
}) { return null; }
