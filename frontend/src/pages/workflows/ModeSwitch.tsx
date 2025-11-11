// src/pages/workflows/ModeSwitch.tsx
import { PackageCheck, Truck } from "lucide-react";

export type ViewMode = "edi945" | "delivery" | "no_sonum";

export default function ModeSwitch({
  mode,
  setMode,
}: {
  mode: ViewMode;
  setMode: (m: ViewMode) => void;
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Choose Workflow</h3>
          <p className="mt-1 text-sm text-gray-600">
            Pick which reconciliation you want to run.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setMode("edi945")}
            className={`px-4 py-2 rounded-lg border text-sm font-semibold flex items-center gap-2 transition-all ${
              mode === "edi945"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            Ship Confirmation (EDI 945)
          </button>
          <button
            onClick={() => setMode("delivery")}
            className={`px-4 py-2 rounded-lg border text-sm font-semibold flex items-center gap-2 transition-all ${
              mode === "delivery"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            <Truck className="w-4 h-4" />
            Delivery Confirmation
          </button>
          <button
            onClick={() => setMode("no_sonum")}
            className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all ${
              mode === "no_sonum"
                ? "bg-blue-600 text-white border border-blue-600"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            NO_SONUM
          </button>
        </div>
      </div>
    </section>
  );
}
