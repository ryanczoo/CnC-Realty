import { PHONE_TABLE_FRAME } from "@/lib/dashboard-phone";
import { TABLE_HEAD_DARK_ROW, TABLE_HEAD_DARK_CELL } from "@/lib/table-styles";
interface AdminTableProps {
  headers: string[];
  children: React.ReactNode;
}

export function AdminTable({ headers, children }: AdminTableProps) {
  return (
    <div className={`overflow-hidden rounded-2xl bg-white shadow-sm ${PHONE_TABLE_FRAME}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className={TABLE_HEAD_DARK_ROW}>
            {headers.map((h) => (
              <th
                key={h}
                className={`px-4 py-3 text-left ${TABLE_HEAD_DARK_CELL}`}
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
