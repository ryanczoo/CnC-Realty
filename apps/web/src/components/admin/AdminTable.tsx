interface AdminTableProps {
  headers: string[];
  children: React.ReactNode;
}

export function AdminTable({ headers, children }: AdminTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#F2F0EF]">
            {headers.map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[#1B1B1B]/50"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
