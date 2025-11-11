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
