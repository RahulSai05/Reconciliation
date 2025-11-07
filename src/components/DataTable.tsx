
// import React from 'react';
// import { AlertTriangle } from 'lucide-react';

// export interface StuckRow {
//   Pickticket: string;
//   Order: string;
//   Warehouse: string;
//   'Ship To'?: string;
//   'Issue Summary'?: string;
//   AgeHours?: number | string;
//   Severity?: 'high' | 'medium' | 'low' | string;
//   OrderValue?: number | string;
//   'EDI Message'?: string; // Ensure this is included
// }

// interface DataTableProps {
//   data: StuckRow[];
// }

// function SLABadge({ age }: { age?: number }) {
//   const a = typeof age === 'number' ? age : Number(age ?? 0);
//   if (a >= 24) {
//     return (
//       <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200 rounded px-2 py-[2px] leading-none">
//         <AlertTriangle className="w-3 h-3" />
//         Breach Risk
//       </span>
//     );
//   }
//   if (a >= 8) {
//     return (
//       <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 rounded px-2 py-[2px] leading-none">
//         Approaching SLA
//       </span>
//     );
//   }
//   return (
//     <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-gray-100 text-gray-600 border border-gray-200 rounded px-2 py-[2px] leading-none">
//       Stable
//     </span>
//   );
// }

// export default function DataTable({ data }: DataTableProps) {
//   return (
//     <div className="overflow-x-auto text-sm">
//       <table className="min-w-full w-full table-fixed text-left border-collapse">
//         <colgroup>
//           <col className="w-[12%]" />
//           <col className="w-[12%]" />
//           <col className="w-[13%]" />
//           <col className="w-[18%]" />
//           <col className="w-[30%]" />
//           <col className="w-[7%]" />
//           <col className="w-[8%]" />
//         </colgroup>

//         <thead className="bg-gray-50 border-b border-gray-200 text-[11px] uppercase tracking-wide text-gray-500">
//           <tr>
//             <th className="px-4 py-2 font-medium">Pickticket</th>
//             <th className="px-4 py-2 font-medium">Order</th>
//             <th className="px-4 py-2 font-medium">Warehouse</th>
//             <th className="px-4 py-2 font-medium">Ship To</th>
//             <th className="px-4 py-2 font-medium">Issue / Reason</th>
//             <th className="px-4 py-2 font-medium text-right">Age (hrs)</th>
//             <th className="px-4 py-2 font-medium">SLA</th>
//           </tr>
//         </thead>

//         <tbody className="divide-y divide-gray-100 bg-white text-[13px] text-gray-800">
//           {data.length === 0 ? (
//             <tr>
//               <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">
//                 No matching exceptions. Nice work.
//               </td>
//             </tr>
//           ) : (
//             data.map((row, i) => {
//               const age =
//                 row.AgeHours !== undefined && row.AgeHours !== null
//                   ? Number(row.AgeHours)
//                   : undefined;

//               return (
//                 <tr key={i} className="hover:bg-blue-50/40 transition-colors">
//                   <td className="px-4 py-3 font-mono text-[12px] text-gray-900 truncate">
//                     {row.Pickticket || '—'}
//                   </td>
//                   <td className="px-4 py-3 font-mono text-[12px] text-gray-900 truncate">
//                     {row.Order || '—'}
//                   </td>

//                   <td className="px-4 py-3">
//                     <div className="text-gray-900 font-medium truncate">
//                       {row.Warehouse || '—'}
//                     </div>
//                     {row.Severity && (
//                       <div
//                         className={`text-[10px] font-semibold ${
//                           row.Severity === 'high'
//                             ? 'text-red-600'
//                             : row.Severity === 'medium'
//                             ? 'text-amber-600'
//                             : 'text-gray-500'
//                         }`}
//                       >
//                         Priority: {String(row.Severity).slice(0,1).toUpperCase() + String(row.Severity).slice(1)}
//                       </div>
//                     )}
//                   </td>

//                   <td className="px-4 py-3">
//                     <div className="leading-tight truncate">{row['Ship To'] || '—'}</div>
//                   </td>

//                   <td className="px-4 py-3">
//                     <div className="text-gray-900 leading-tight truncate">
//                       {row['Issue Summary'] || 'AX Load Failure'}
//                     </div>
//                     <div className="text-[11px] text-gray-500 leading-tight">
//                       {row['EDI Message'] || 'Shipped but not posted / not confirmed'}
//                     </div>
//                   </td>

//                   <td className="px-4 py-3 font-mono text-[12px] text-right text-gray-900">
//                     {age !== undefined && !Number.isNaN(age) ? Math.round(age) : '—'}
//                   </td>

//                   <td className="px-4 py-3">
//                     <SLABadge age={age} />
//                   </td>
//                 </tr>
//               );
//             })
//           )}
//         </tbody>
//       </table>
//     </div>
//   );
// }

import React from "react";
import type { StuckShipment } from "../types";

interface Props {
  data: StuckShipment[];
}

export default function DataTable({ data }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full table-fixed">
        {/* Fix widths so AGE/SLA don’t drift to the far right */}
        <colgroup>
          <col style={{ width: "12%" }} /> {/* Pickticket */}
          <col style={{ width: "10%" }} /> {/* Order */}
          <col style={{ width: "14%" }} /> {/* Warehouse */}
          <col style={{ width: "22%" }} /> {/* Ship To */}
          <col style={{ width: "26%" }} /> {/* Issue / Reason */}
          <col style={{ width: "8%" }} />  {/* Age (hrs) */}
          <col style={{ width: "8%" }} />  {/* SLA */}
        </colgroup>

        <thead className="bg-gray-50 text-xs font-bold text-gray-600">
          <tr>
            <th className="px-4 py-3 text-left">Pickticket</th>
            <th className="px-4 py-3 text-left">Order</th>
            <th className="px-4 py-3 text-left">Warehouse</th>
            <th className="px-4 py-3 text-left">Ship To</th>
            <th className="px-4 py-3 text-left">Issue / Reason</th>
            <th className="px-4 py-3 text-right">Age (hrs)</th>
            <th className="px-4 py-3 text-right">SLA</th>
          </tr>
        </thead>

        <tbody className="bg-white text-sm">
          {data.map((row, i) => {
            const age = row["Age Hours"] ?? null;
            const badge = row["Age Badge Class"] ?? "badge-neutral";
            const severity = row.Severity ?? "unknown";

            const slaChip =
              severity === "high"
                ? { text: "Breach Risk", cls: "bg-rose-100 text-rose-700" }
                : severity === "medium"
                ? { text: "Approaching SLA", cls: "bg-amber-100 text-amber-800" }
                : severity === "low"
                ? { text: "Within SLA", cls: "bg-emerald-100 text-emerald-700" }
                : { text: "Unknown", cls: "bg-gray-100 text-gray-700" };

            return (
              <tr key={i} className="border-b border-gray-100">
                <td className="px-4 py-3 font-mono text-gray-900 truncate">{row.Pickticket}</td>
                <td className="px-4 py-3 font-mono text-gray-700 truncate">{String((row as any).Order ?? "")}</td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-gray-900 truncate">{(row as any).Warehouse ?? "—"}</div>
                  <div className="text-[11px] text-amber-700">Priority: {severity === "high" ? "High" : severity === "medium" ? "Medium" : "Low"}</div>
                </td>
                <td className="px-4 py-3 text-gray-700 truncate">{(row as any)["Ship To"] ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-gray-900 truncate">{row["Issue Summary"]}</div>
                  <div className="text-xs text-gray-500 truncate">
                    Shipped but not posted / not confirmed
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-gray-900">
                  {age !== null ? Math.round(age) : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`inline-block text-[11px] px-2.5 py-1 rounded-md font-semibold ${slaChip.cls}`}>
                    {slaChip.text}
                  </span>
                </td>
              </tr>
            );
          })}
          {data.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                No exceptions match your filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
